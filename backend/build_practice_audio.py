"""Build synchronized backing and guitar WAVs from cached Klangio stems."""

from __future__ import annotations

import argparse
import json
import wave
from pathlib import Path

import numpy as np


BACKING_STEMS = ("bass", "drums", "other", "piano", "vocals")


def find_stem(cache_root: Path, stem_name: str) -> Path:
    matches = sorted(cache_root.glob(f"source-separation/*/outputs/stems/{stem_name}.wav"))
    if not matches:
        raise FileNotFoundError(f"No cached {stem_name} stem in {cache_root}")
    return matches[0]


def read_pcm16(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as source:
        if source.getsampwidth() != 2 or source.getcomptype() != "NONE":
            raise ValueError(f"Expected uncompressed PCM16 WAV: {path}")
        channels = source.getnchannels()
        sample_rate = source.getframerate()
        frames = source.readframes(source.getnframes())
    audio = np.frombuffer(frames, dtype="<i2").reshape(-1, channels).astype(np.float32) / 32768.0
    return audio, sample_rate


def write_pcm16(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = np.clip(audio, -1.0, 1.0)
    encoded = (encoded * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as destination:
        destination.setnchannels(encoded.shape[1])
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(encoded.tobytes())


def build_tracks(window_specs: list[tuple[float, Path]]) -> tuple[np.ndarray, np.ndarray, int]:
    if not window_specs:
        raise ValueError("At least one cached window is required")

    windows: list[tuple[int, np.ndarray, np.ndarray]] = []
    sample_rate: int | None = None
    channels: int | None = None
    total_frames = 0

    for offset_sec, cache_root in sorted(window_specs, key=lambda item: item[0]):
        guitar, window_rate = read_pcm16(find_stem(cache_root, "guitar"))
        if sample_rate is None:
            sample_rate = window_rate
            channels = guitar.shape[1]
        if window_rate != sample_rate or guitar.shape[1] != channels:
            raise ValueError("All cached stems must share a sample rate and channel count")

        backing = np.zeros_like(guitar)
        for stem_name in BACKING_STEMS:
            stem, stem_rate = read_pcm16(find_stem(cache_root, stem_name))
            if stem_rate != sample_rate or stem.shape != guitar.shape:
                raise ValueError(f"Stem format mismatch for {stem_name} in {cache_root}")
            backing += stem

        offset_frames = round(offset_sec * sample_rate)
        windows.append((offset_frames, backing, guitar))
        total_frames = max(total_frames, offset_frames + guitar.shape[0])

    assert sample_rate is not None and channels is not None
    backing_track = np.zeros((total_frames, channels), dtype=np.float32)
    guitar_track = np.zeros_like(backing_track)
    coverage = np.zeros((total_frames, 1), dtype=np.float32)

    for offset_frames, backing, guitar in windows:
        end = offset_frames + guitar.shape[0]
        backing_track[offset_frames:end] += backing
        guitar_track[offset_frames:end] += guitar
        coverage[offset_frames:end] += 1.0

    if np.any(coverage == 0):
        raise ValueError("Cached stem windows leave a gap in the practice audio")
    backing_track /= coverage
    guitar_track /= coverage

    reconstruction_peak = float(np.max(np.abs(backing_track + guitar_track)))
    scale = min(1.0, 0.98 / reconstruction_peak) if reconstruction_peak else 1.0
    return backing_track * scale, guitar_track * scale, sample_rate


def parse_window(value: str) -> tuple[float, Path]:
    offset, path = value.split(";", 1)
    return float(offset), Path(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--window", action="append", required=True, help="Window as OFFSET_SECONDS;CACHE_ROOT")
    parser.add_argument("--backing-output", type=Path, required=True)
    parser.add_argument("--guitar-output", type=Path, required=True)
    parser.add_argument("--report-output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    backing, guitar, sample_rate = build_tracks([parse_window(value) for value in args.window])
    write_pcm16(args.backing_output, backing, sample_rate)
    write_pcm16(args.guitar_output, guitar, sample_rate)
    report = {
        "backingOutput": str(args.backing_output),
        "guitarOutput": str(args.guitar_output),
        "sampleRate": sample_rate,
        "channels": int(backing.shape[1]),
        "durationSec": round(backing.shape[0] / sample_rate, 3),
        "windows": [{"offsetSec": offset, "cacheRoot": str(path)} for offset, path in map(parse_window, args.window)],
    }
    if args.report_output:
        args.report_output.parent.mkdir(parents=True, exist_ok=True)
        args.report_output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
