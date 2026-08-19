"""Deterministic publication checks for a GuitarFlow lesson model.

Provider output is evidence, not musical truth.  These checks combine strict
timeline invariants with a lightweight beat-synchronous chroma audit of the
cached guitar stem.  A suspicious acoustic change without a nearby chord
boundary blocks publication until a reviewed correction resolves it.
"""

from __future__ import annotations

import math
import re
import wave
from pathlib import Path
from typing import Any

import numpy as np


ROOT_PITCH_CLASSES = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}


def _triad_template(chord: str) -> np.ndarray | None:
    match = re.match(r"^([A-G](?:#|b)?)(m?)", chord)
    if not match:
        return None
    root = ROOT_PITCH_CLASSES[match.group(1)]
    third = 3 if match.group(2) else 4
    template = np.zeros(12, dtype=np.float64)
    template[[root, (root + third) % 12, (root + 7) % 12]] = 1.0
    return template / np.linalg.norm(template)


def _read_mono_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_rate = source.getframerate()
        sample_width = source.getsampwidth()
        frames = source.readframes(source.getnframes())
    if sample_width != 2:
        raise ValueError(f"Quality audit requires 16-bit PCM WAV, got {sample_width * 8}-bit")
    audio = np.frombuffer(frames, dtype="<i2").astype(np.float64)
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio / 32768.0, sample_rate


def _beat_chroma(audio: np.ndarray, sample_rate: int, time_sec: float) -> np.ndarray:
    start = max(0, int((time_sec - 0.05) * sample_rate))
    end = min(len(audio), int((time_sec + 0.55) * sample_rate))
    if end - start < 32:
        return np.zeros(12, dtype=np.float64)
    frame = audio[start:end] * np.hanning(end - start)
    spectrum = np.abs(np.fft.rfft(frame))
    frequencies = np.fft.rfftfreq(len(frame), 1 / sample_rate)
    chroma = np.zeros(12, dtype=np.float64)
    for frequency, magnitude in zip(frequencies[1:], spectrum[1:]):
        if 70 <= frequency <= 1400:
            midi = round(69 + 12 * math.log2(frequency / 440))
            chroma[midi % 12] += math.sqrt(float(magnitude))
    norm = np.linalg.norm(chroma)
    return chroma / norm if norm else chroma


def find_unexplained_chord_changes(
    chords: list[dict[str, Any]],
    beats: list[dict[str, Any]],
    guitar_audio: Path,
    boundary_tolerance_sec: float = 0.12,
) -> list[dict[str, Any]]:
    """Find strong alternative-triad evidence at beats lacking a boundary.

    This deliberately flags only high-specificity cases: the alternative
    triad must become nearly as plausible as the labelled chord and rise
    sharply from the previous beat. It is a review gate, not an automatic
    chord replacement system.
    """
    templates = {
        chord: template
        for chord in sorted({str(event["chord"]) for event in chords})
        if (template := _triad_template(chord)) is not None
    }
    if len(templates) < 2 or len(beats) < 2:
        return []
    audio, sample_rate = _read_mono_wav(guitar_audio)
    chromas = [_beat_chroma(audio, sample_rate, float(beat["timeSec"])) for beat in beats]
    findings: list[dict[str, Any]] = []
    for index in range(1, len(beats)):
        time_sec = float(beats[index]["timeSec"])
        active = next((event for event in chords if float(event["startSec"]) <= time_sec < float(event["endSec"])), None)
        if not active or active["chord"] not in templates:
            continue
        if min(abs(time_sec - float(event["startSec"])) for event in chords) <= boundary_tolerance_sec:
            continue
        current_scores = {name: float(chromas[index] @ template) for name, template in templates.items()}
        previous_scores = {name: float(chromas[index - 1] @ template) for name, template in templates.items()}
        alternatives = [name for name in templates if name != active["chord"]]
        candidate = max(alternatives, key=lambda name: current_scores[name])
        labelled_score = current_scores[active["chord"]]
        candidate_score = current_scores[candidate]
        candidate_rise = candidate_score - previous_scores[candidate]
        if candidate_score >= 0.60 and labelled_score - candidate_score <= 0.035 and candidate_rise >= 0.14:
            findings.append({
                "timeSec": round(time_sec, 3),
                "labelledChord": active["chord"],
                "candidateChord": candidate,
                "labelledScore": round(labelled_score, 4),
                "candidateScore": round(candidate_score, 4),
                "candidateRise": round(candidate_rise, 4),
                "reason": "Beat-synchronous guitar chroma changed without a nearby chord boundary.",
            })
    return findings


def structural_findings(song: dict[str, Any]) -> list[str]:
    findings: list[str] = []
    chords = song.get("chordEvents", [])
    beats = song.get("beats", [])
    duration = float(song.get("audio", {}).get("durationSec", 0))
    tempo = song.get("tempo", {})
    capo_fret = int(song.get("metadata", {}).get("capoFret", 0))
    lesson_mode = str(song.get("metadata", {}).get("mode", ""))
    if not 20 <= float(tempo.get("bpm", 0)) <= 300:
        findings.append("Tempo must be between 20 and 300 BPM.")
    if int(tempo.get("beatsPerBar", 0)) not in {3, 4}:
        findings.append("Time signature must currently be validated as 3/4 or 4/4.")
    if int(tempo.get("beatUnit", 0)) != 4:
        findings.append("Beat unit must be a quarter note.")
    if not 0 <= capo_fret <= 9:
        findings.append("Capo fret must be between 0 and 9 for the 12-fret player view.")
    for name, voicing in song.get("voicings", {}).items():
        fretted = [int(fret) for fret in voicing.get("frets", []) if isinstance(fret, (int, float)) and fret > 0]
        if fretted and max(fretted) + capo_fret > 12:
            findings.append(f"{name} projects beyond the 12-fret player view at capo {capo_fret}.")
    if lesson_mode.lower() not in {"chord", "chords", "chord mode"} and song.get("analysis", {}).get("noteReport", {}).get("status") != "pass":
        findings.append("A note-level lesson requires a passing independent note report before publication.")
    if not chords:
        findings.append("At least one chord event is required.")
    for index, event in enumerate(chords):
        start = float(event.get("startSec", -1))
        end = float(event.get("endSec", -1))
        if start < 0 or end <= start or end > duration + 0.001:
            findings.append(f"Chord event {index} has invalid bounds.")
        if index and abs(float(chords[index - 1]["endSec"]) - start) > 0.001:
            findings.append(f"Chord events {index - 1} and {index} have a gap or overlap.")
    if beats:
        for index, beat in enumerate(beats):
            time_sec = float(beat["timeSec"])
            if chords and time_sec >= float(chords[0]["startSec"]) and not any(float(event["startSec"]) <= time_sec < float(event["endSec"]) for event in chords):
                findings.append(f"Beat at {time_sec:.3f}s has no active chord.")
            if index:
                previous_number = int(round(float(beats[index - 1]["beat"])))
                expected = previous_number % int(tempo.get("beatsPerBar", 1)) + 1
                current_number = int(round(float(beat["beat"])))
                if current_number != expected:
                    findings.append(f"Beat sequence jumps from {previous_number} to {current_number} at {time_sec:.3f}s; expected {expected}.")
    else:
        findings.append("Beat tracking is required for count-in and validation.")
    return findings


def build_quality_report(
    song: dict[str, Any],
    guitar_audio: Path | None,
    raw_chords: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    structural = structural_findings(song)
    raw_acoustic = find_unexplained_chord_changes(raw_chords or song["chordEvents"], song["beats"], guitar_audio) if guitar_audio else []
    unresolved = find_unexplained_chord_changes(song["chordEvents"], song["beats"], guitar_audio) if guitar_audio else []
    publication_blocked = bool(structural or unresolved or guitar_audio is None)
    return {
        "status": "review_required" if publication_blocked else "pass",
        "publicationBlocked": publication_blocked,
        "structuralFindings": structural,
        "rawProviderFindings": raw_acoustic,
        "unresolvedFindings": unresolved,
        "unresolvedFindingCount": len(unresolved),
        "audioAudit": "beat-synchronous guitar chroma" if guitar_audio else "not run",
        "noteValidation": "not applicable to Chord Mode" if str(song.get("metadata", {}).get("mode", "")).lower() in {"chord", "chords", "chord mode"} else "pass",
    }
