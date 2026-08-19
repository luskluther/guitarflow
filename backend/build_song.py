"""Build a GuitarFlow canonical song model from cached analysis windows."""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from pathlib import Path
from typing import Any

try:
    from backend.song_quality import build_quality_report
except ModuleNotFoundError:  # Direct `python backend/build_song.py` execution.
    from song_quality import build_quality_report


CHORD_SHAPES: dict[str, dict[str, Any]] = {
    # Arrays are always high-e to low-E. The player-view fretboard decides how
    # those strings are arranged visually; the canonical pose never changes.
    "G": {"displayName": "G Major", "frets": [3, 0, 0, 0, 2, 3], "fingers": [3, 0, 0, 0, 1, 2]},
    "C": {"displayName": "C Major", "frets": [0, 1, 0, 2, 3, None], "fingers": [0, 1, 0, 2, 3, 0]},
    "D": {"displayName": "D Major", "frets": [2, 3, 2, 0, None, None], "fingers": [2, 3, 1, 0, 0, 0]},
    "Em": {"displayName": "E Minor", "frets": [0, 0, 0, 2, 2, 0], "fingers": [0, 0, 0, 3, 2, 0]},
}

LYRIC_CORRECTIONS = {"rest,": "wrist,"}

# The provider smoothed over the short C/Cadd9 change audible around “fork
# stuck.” Keep its immutable response as provenance, but repair the canonical
# lesson at the cached beat confirmed by stem review and product-owner audit.
AUDITED_CHORD_CORRECTIONS = [
    {
        "timeSec": 14.11,
        "chord": "C",
        "reason": "Klangio held G across the audible C/Cadd9 change at 'fork stuck'; snapped to cached beat 3.",
    }
]


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def response_json(cache_root: Path, job_name: str) -> Any:
    matches = sorted((cache_root / job_name).glob("*/result/response.json"))
    if not matches:
        raise FileNotFoundError(f"No cached {job_name} result in {cache_root}")
    return read_json(matches[0])


def normalize_chord_name(value: str) -> str:
    match = re.match(r"^([A-G](?:#|b)?)(?::(maj|min))?$", value)
    if not match:
        return value
    root, quality = match.groups()
    return root if quality != "min" else f"{root}m"


def pose_id(chord: str) -> str:
    return f"{chord.replace('#', 'Sharp').replace('b', 'Flat').replace('m', 'Minor')}_OPEN"


def infer_beats_per_bar(beats: list[dict[str, Any]]) -> int:
    observed = [int(round(float(beat["beat"]))) for beat in beats if float(beat.get("beat", 0)) > 0]
    return max(observed) if observed else 0


def infer_bpm(beats: list[dict[str, Any]]) -> float:
    times = sorted(float(beat["timeSec"]) for beat in beats)
    intervals = [later - earlier for earlier, later in zip(times, times[1:]) if 0.2 <= later - earlier <= 0.9]
    return float(round(60 / statistics.mean(intervals))) if intervals else 0.0


def repair_beat_grid(beats: list[dict[str, Any]], beats_per_bar: int, duration_sec: float | None = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    repaired = [dict(beat) for beat in sorted(beats, key=lambda item: float(item["timeSec"]))]
    if len(repaired) < 3 or beats_per_bar not in {3, 4}:
        return repaired, []
    intervals = [float(later["timeSec"]) - float(earlier["timeSec"]) for earlier, later in zip(repaired, repaired[1:])]
    ordinary = [interval for interval in intervals if 0.2 <= interval <= 0.9]
    if not ordinary:
        return repaired, []
    beat_interval = statistics.median(ordinary)
    repairs: list[dict[str, Any]] = []
    output: list[dict[str, Any]] = []
    first_number = int(round(float(repaired[0]["beat"])))
    leading: list[dict[str, Any]] = []
    cursor_time = float(repaired[0]["timeSec"])
    cursor_number = first_number
    while cursor_number > 1 and cursor_time - beat_interval >= 0:
        cursor_time -= beat_interval
        cursor_number -= 1
        inserted = {"timeSec": round(cursor_time, 3), "beat": float(cursor_number), "derived": True}
        leading.insert(0, inserted)
        repairs.append({"timeSec": inserted["timeSec"], "beat": cursor_number, "reason": "Restored a leading beat omitted by the provider window."})
    output.extend(leading)
    output.append(repaired[0])
    for event in repaired[1:]:
        previous = output[-1]
        gap = float(event["timeSec"]) - float(previous["timeSec"])
        missing_count = max(0, round(gap / beat_interval) - 1)
        if missing_count and gap <= beat_interval * (missing_count + 1.45):
            step = gap / (missing_count + 1)
            for offset in range(1, missing_count + 1):
                beat_number = int(round(float(previous["beat"]))) % beats_per_bar + 1
                inserted = {"timeSec": round(float(previous["timeSec"]) + step, 3), "beat": float(beat_number), "derived": True}
                output.append(inserted)
                repairs.append({"timeSec": inserted["timeSec"], "beat": beat_number, "reason": "Filled a provider-window beat gap for continuous metronome timing."})
                previous = inserted
        output.append(event)
    if duration_sec is not None:
        while float(output[-1]["timeSec"]) + beat_interval < duration_sec:
            previous = output[-1]
            beat_number = int(round(float(previous["beat"]))) % beats_per_bar + 1
            inserted = {"timeSec": round(float(previous["timeSec"]) + beat_interval, 3), "beat": float(beat_number), "derived": True}
            output.append(inserted)
            repairs.append({"timeSec": inserted["timeSec"], "beat": beat_number, "reason": "Restored a trailing beat omitted by the provider window."})
    return output, repairs


def merge_windows(window_specs: list[tuple[float, Path]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    chords: list[dict[str, Any]] = []
    strums: list[dict[str, Any]] = []
    beats: list[dict[str, Any]] = []
    metadata: list[dict[str, Any]] = []
    for offset, cache_root in window_specs:
        chord_data = response_json(cache_root, "chord-recognition-extended")
        beat_data = response_json(cache_root, "beat-tracking")
        for start, end, name in chord_data.get("chords", []):
            normalized = normalize_chord_name(name)
            if normalized in {"N", "X"}:
                continue
            chords.append({"startSec": round(float(start) + offset, 3), "endSec": round(float(end) + offset, 3), "chord": normalized})
        for timestamp, direction in chord_data.get("strums", []):
            strums.append({"timeSec": round(float(timestamp) + offset, 3), "direction": direction})
        for timestamp, beat in beat_data:
            beats.append({"timeSec": round(float(timestamp) + offset, 3), "beat": beat})
        manifest = read_json(cache_root / "manifest.json")
        metadata.append({"offsetSec": offset, "source": manifest.get("source"), "jobs": manifest.get("jobs", [])})
    chords.sort(key=lambda event: event["startSec"])
    strums.sort(key=lambda event: event["timeSec"])
    beats.sort(key=lambda event: event["timeSec"])
    return chords, strums, beats, metadata


def context_for_time(chords: list[dict[str, Any]], time_sec: float) -> dict[str, Any]:
    active_index = next((i for i, event in enumerate(chords) if event["startSec"] <= time_sec < event["endSec"]), None)
    if active_index is None:
        prior = [event for event in chords if event["endSec"] <= time_sec]
        upcoming = [event for event in chords if event["startSec"] > time_sec]
        current = None
    else:
        current = chords[active_index]
        prior = chords[:active_index]
        upcoming = chords[active_index + 1 :]
    previous = prior[-1] if prior else None
    next_event = upcoming[0] if upcoming else None
    return {
        "previous": previous["chord"] if previous else None,
        "current": current["chord"] if current else None,
        "next": next_event["chord"] if next_event else None,
        "nextChangeSec": next_event["startSec"] if next_event else None,
    }


def snap_chord_boundaries_to_beats(
    chords: list[dict[str, Any]],
    beats: list[dict[str, Any]],
    maximum_shift: float = 0.36,
) -> list[dict[str, Any]]:
    """Move provider chord boundaries onto the nearest cached musical beat.

    Windowed recognition can force the first chord of a window to timestamp
    zero even when the audible attack occurs later. Beat snapping repairs that
    edge artifact in the derived lesson model without changing raw responses.
    """
    snapped = [dict(event) for event in chords]
    beat_times = sorted(float(beat["timeSec"]) for beat in beats)
    for index in range(1, len(snapped)):
        original = float(snapped[index]["startSec"])
        if not beat_times:
            break
        nearest = min(beat_times, key=lambda beat_time: abs(beat_time - original))
        if abs(nearest - original) > maximum_shift:
            continue
        minimum = float(snapped[index - 1]["startSec"]) + 0.08
        maximum = float(snapped[index]["endSec"]) - 0.08
        boundary = round(max(minimum, min(maximum, nearest)), 3)
        snapped[index - 1]["endSec"] = boundary
        snapped[index]["startSec"] = boundary
    return snapped


def apply_audited_chord_corrections(
    chords: list[dict[str, Any]],
    corrections: list[dict[str, Any]] = AUDITED_CHORD_CORRECTIONS,
) -> list[dict[str, Any]]:
    """Insert reviewed musical boundaries without altering provider artifacts."""
    corrected = [dict(event) for event in chords]
    for correction in sorted(corrections, key=lambda item: float(item["timeSec"])):
        time_sec = round(float(correction["timeSec"]), 3)
        chord = str(correction["chord"])
        active_index = next(
            (index for index, event in enumerate(corrected) if float(event["startSec"]) < time_sec < float(event["endSec"])),
            None,
        )
        if active_index is None:
            raise ValueError(f"Audited chord correction at {time_sec} does not fall inside an event")
        active = corrected[active_index]
        if active["chord"] == chord:
            continue
        before = {**active, "endSec": time_sec}
        after = {**active, "startSec": time_sec, "chord": chord}
        corrected[active_index : active_index + 1] = [before, after]
    return corrected


def words_with_chord_context(chords: list[dict[str, Any]], words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {**word, "chordContext": context_for_time(chords, float(word["startSec"]))}
        for word in words
    ]


def apply_lyric_corrections(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{**word, "text": LYRIC_CORRECTIONS.get(str(word.get("text", "")), str(word.get("text", "")))} for word in words]


def repair_zero_duration_words(words: list[dict[str, Any]], minimum_duration: float = 0.08) -> list[dict[str, Any]]:
    """Repair ASR zero-length cues without changing immutable transcript artifacts.

    Whisper can assign a short article and the following word the same timestamp.
    The canonical lesson gives that article a small, non-overlapping interval
    immediately before the shared boundary so the UI never highlights two words
    at once or creates an unreachable cue.
    """
    repaired = [dict(word) for word in words]
    for index, word in enumerate(repaired):
        start = float(word["startSec"])
        end = float(word["endSec"])
        if end > start:
            continue
        previous_end = float(repaired[index - 1]["endSec"]) if index else 0.0
        word["endSec"] = round(start, 3)
        word["startSec"] = round(max(previous_end, start - minimum_duration), 3)
        if word["startSec"] >= word["endSec"]:
            raise ValueError(f"Cannot repair zero-duration lyric cue at {start}: {word.get('text')!r}")
    return repaired


def build_song(
    audio: Path,
    lyrics_path: Path,
    window_specs: list[tuple[float, Path]],
    guitar_audio: Path | None = None,
    corrections: list[dict[str, Any]] | None = None,
    enforce_quality: bool = False,
) -> dict[str, Any]:
    lyrics = read_json(lyrics_path)
    chords, strums, beats, window_metadata = merge_windows(window_specs)
    provider_beats = [dict(beat) for beat in beats]
    provider_beat_count = len(beats)
    beats_per_bar = infer_beats_per_bar(beats)
    beats, beat_repairs = repair_beat_grid(beats, beats_per_bar)
    # Only provider-observed beats may move harmonic boundaries. Derived beats
    # exist to keep the metronome grid continuous and must not rewrite chords.
    chords = snap_chord_boundaries_to_beats(chords, provider_beats)
    provider_chords = [dict(event) for event in chords]
    reviewed_corrections = corrections or []
    chords = apply_audited_chord_corrections(chords, reviewed_corrections)
    chord_events = []
    for event in chords:
        shape = CHORD_SHAPES.get(event["chord"], {"displayName": event["chord"], "frets": [], "fingers": []})
        chord_events.append(
            {
                **event,
                "displayName": shape["displayName"],
                "poseId": pose_id(event["chord"]),
                "context": context_for_time(chords, event["startSec"]),
            }
        )
    lyric_words = words_with_chord_context(chords, repair_zero_duration_words(apply_lyric_corrections(lyrics.get("words", []))))
    lyric_segments = []
    for segment in lyrics.get("segments", []):
        segment_words = words_with_chord_context(chords, repair_zero_duration_words(apply_lyric_corrections(segment.get("words", []))))
        segment_start = min(
            [float(segment["startSec"]), *[float(word["startSec"]) for word in segment_words]]
        )
        segment_end = max(
            [float(segment["endSec"]), *[float(word["endSec"]) for word in segment_words]]
        )
        lyric_segments.append(
            {
                **segment,
                "text": " ".join(word["text"] for word in segment_words),
                "startSec": round(segment_start, 3),
                "endSec": round(segment_end, 3),
                "words": segment_words,
            }
        )
    all_times = [event["endSec"] for event in chords] + [word["endSec"] for word in lyric_words]
    duration = max(all_times) if all_times else 0.0
    beats, edge_repairs = repair_beat_grid(beats, beats_per_bar, duration)
    beat_repairs.extend(edge_repairs)
    chord_coverage = sum(max(0.0, event["endSec"] - event["startSec"]) for event in chords)
    bpm = infer_bpm(beats)
    phrases = [
        {
            "id": f"phrase-{index + 1}",
            "label": f"Phrase {index + 1}",
            "startSec": round(max(0.0, float(segment["startSec"]) - 0.45), 3),
            "endSec": round(min(duration, float(segment["endSec"]) + 0.45), 3),
        }
        for index, segment in enumerate(lyric_segments)
    ]
    song = {
        "schemaVersion": 1,
        "metadata": {
            "title": "Good Riddance (Time of Your Life)",
            "artist": "Green Day",
            "mode": "Chords",
            "difficulty": "Beginner",
            "key": "G major",
            "capoFret": 0,
        },
        "audio": {
            "sourcePath": str(audio),
            "originalPath": "/fixtures/spike-a-ui-30s.wav",
            "backingPath": "/fixtures/backing.wav",
            "guitarPath": "/fixtures/guitar.wav",
            "durationSec": round(duration, 3),
        },
        "tempo": {"bpm": bpm, "beatsPerBar": beats_per_bar, "beatUnit": 4},
        "beats": beats,
        "phrases": phrases,
        "lyrics": {"language": lyrics.get("language", "en"), "segments": lyric_segments, "words": lyric_words},
        "chordEvents": chord_events,
        "strumEvents": strums,
        "voicings": CHORD_SHAPES,
        "analysis": {
            "windows": window_metadata,
            "lyricReport": lyrics.get("metrics", {}),
            "beatReport": {"providerCount": provider_beat_count, "derivedCount": len(beats), "repairs": beat_repairs},
            "chordReport": {
                "provider": "Klangio chord-recognition-extended",
                "coverageRatio": round(chord_coverage / duration, 4) if duration else 0.0,
                "recognizedChords": sorted({event["chord"] for event in chords}),
                "beginnerSimplification": True,
                "warning": "Chord qualities are provider-derived and simplified to deterministic beginner voicings; reviewed overrides are disclosed separately.",
                "corrections": reviewed_corrections,
            },
        },
    }
    quality_report = build_quality_report(song, guitar_audio, provider_chords)
    song["analysis"]["qualityGate"] = quality_report
    if enforce_quality and quality_report["publicationBlocked"]:
        details = [*quality_report["structuralFindings"], *[finding["reason"] for finding in quality_report["unresolvedFindings"]]]
        if guitar_audio is None:
            details.append("Cached guitar audio is required for the acoustic publication audit.")
        raise ValueError("Song publication blocked: " + "; ".join(details))
    return song


def parse_window(value: str) -> tuple[float, Path]:
    offset, path = value.split(";", 1)
    return float(offset), Path(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--lyrics", type=Path, required=True)
    parser.add_argument("--window", action="append", required=True, help="Window as OFFSET_SECONDS;CACHE_ROOT")
    parser.add_argument("--guitar-audio", type=Path, required=True, help="Cached isolated guitar WAV used by the publication quality gate")
    parser.add_argument("--corrections", type=Path, help="Optional reviewed per-song chord correction JSON")
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        correction_document = read_json(args.corrections) if args.corrections else {"corrections": []}
        corrections = correction_document if isinstance(correction_document, list) else correction_document.get("corrections", [])
        song = build_song(args.audio, args.lyrics, [parse_window(value) for value in args.window], args.guitar_audio, corrections, enforce_quality=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(song, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"output": str(args.output), "durationSec": song["audio"]["durationSec"], "chords": len(song["chordEvents"]), "lyricsWords": len(song["lyrics"]["words"]), "strums": len(song["strumEvents"]), "qualityGate": song["analysis"]["qualityGate"]["status"]}, indent=2))
        return 0
    except (FileNotFoundError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"Song model build stopped: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
