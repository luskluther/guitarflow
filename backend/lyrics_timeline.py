"""Join cached lyric word timings to cached chord context for UI review."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


class CacheConflict(RuntimeError):
    """Raised when a derived timeline artifact already exists with different data."""


def atomic_write_json(path: Path, value: Any) -> None:
    content = (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != content:
            raise CacheConflict(f"Refusing to overwrite existing artifact: {path}")
        return
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(content)
    temporary.replace(path)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def find_chord_result(musical_cache_root: Path, audio_sha256: str) -> Path | None:
    matches = sorted((musical_cache_root / audio_sha256 / "chord-recognition-extended").glob("*/result/response.json"))
    return matches[0] if matches else None


def non_silent_chords(chords: list[list[Any]]) -> list[dict[str, Any]]:
    return [
        {"startSec": float(start), "endSec": float(end), "name": name}
        for start, end, name in chords
        if name not in {"N", "X"}
    ]


def chord_context(chords: list[dict[str, Any]], time_sec: float) -> dict[str, Any]:
    current_index = next(
        (index for index, chord in enumerate(chords) if chord["startSec"] <= time_sec < chord["endSec"]),
        None,
    )
    previous = None
    if current_index is not None:
        previous_candidates = chords[:current_index]
        if previous_candidates:
            previous = previous_candidates[-1]
        current = chords[current_index]
        next_candidates = chords[current_index + 1 :]
    else:
        current = None
        previous_candidates = [chord for chord in chords if chord["endSec"] <= time_sec]
        if previous_candidates:
            previous = previous_candidates[-1]
        next_candidates = [chord for chord in chords if chord["startSec"] > time_sec]
    upcoming = next_candidates[0] if next_candidates else None
    return {
        "previous": previous["name"] if previous else None,
        "current": current["name"] if current else None,
        "next": upcoming["name"] if upcoming else None,
        "nextChangeSec": upcoming["startSec"] if upcoming else None,
    }


def build_timeline(lyrics: dict[str, Any], musical: dict[str, Any] | None) -> dict[str, Any]:
    audio_sha256 = lyrics["source"]["sha256"]
    if musical is None:
        return {
            "schemaVersion": 1,
            "status": "unavailable",
            "sourceSha256": audio_sha256,
            "reason": "No cached chord-recognition result was found for this audio.",
            "words": lyrics.get("words", []),
            "summary": {"wordCount": len(lyrics.get("words", [])), "wordsWithChordContext": 0},
        }
    chords = non_silent_chords(musical.get("chords", []))
    words = []
    for word in lyrics.get("words", []):
        context = chord_context(chords, float(word["startSec"]))
        words.append({**word, "chordContext": context})
    with_current = sum(1 for word in words if word["chordContext"]["current"])
    with_previous = sum(1 for word in words if word["chordContext"]["previous"])
    with_next = sum(1 for word in words if word["chordContext"]["next"])
    return {
        "schemaVersion": 1,
        "status": "ready",
        "sourceSha256": audio_sha256,
        "key": musical.get("key"),
        "words": words,
        "summary": {
            "wordCount": len(words),
            "wordsWithChordContext": with_current,
            "wordsWithPreviousChord": with_previous,
            "wordsWithNextChord": with_next,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lyrics-cache-dir", type=Path, required=True)
    parser.add_argument("--musical-cache-root", type=Path, default=Path("data/cache/klangio"))
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        lyrics = read_json(args.lyrics_cache_dir / "normalized-lyrics.json")
        chord_path = find_chord_result(args.musical_cache_root, lyrics["source"]["sha256"])
        musical = read_json(chord_path) if chord_path else None
        result = build_timeline(lyrics, musical)
        output = args.output or args.lyrics_cache_dir / "timeline-preview.json"
        atomic_write_json(output, result)
        print(json.dumps({"output": str(output), **result["summary"], "status": result["status"]}, indent=2))
        return 0
    except (CacheConflict, FileNotFoundError, KeyError, json.JSONDecodeError) as error:
        print(f"Lyric timeline stopped: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
