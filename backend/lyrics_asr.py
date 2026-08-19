"""Create cache-first automatic lyric timings from a vocal stem."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_CACHE_ROOT = Path("data/cache/lyrics")


class CacheConflict(RuntimeError):
    """Raised when an existing lyric cache entry is incomplete or inconsistent."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != content:
            raise CacheConflict(f"Refusing to overwrite existing artifact: {path}")
        return
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(content)
    temporary.replace(path)


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_bytes(path, (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8"))


def input_cache_key(audio: Path, model: str, language: str | None, device: str, compute_type: str) -> tuple[str, str]:
    audio_hash = sha256_file(audio)
    request = {
        "audio_sha256": audio_hash,
        "model": model,
        "language": language,
        "device": device,
        "compute_type": compute_type,
        "word_timestamps": True,
        "vad_filter": False,
    }
    return audio_hash, sha256_bytes(canonical_json(request).encode("utf-8"))


def word_to_dict(word: Any) -> dict[str, Any]:
    return {
        "start": float(word.start),
        "end": float(word.end),
        "word": str(word.word),
        "probability": float(getattr(word, "probability", 0.0)),
    }


def segment_to_dict(segment: Any) -> dict[str, Any]:
    words = [word_to_dict(word) for word in (getattr(segment, "words", None) or [])]
    return {
        "id": int(segment.id),
        "start": float(segment.start),
        "end": float(segment.end),
        "text": str(segment.text),
        "avg_logprob": float(getattr(segment, "avg_logprob", 0.0)),
        "no_speech_prob": float(getattr(segment, "no_speech_prob", 0.0)),
        "words": words,
    }


def normalize_transcript(raw: dict[str, Any]) -> dict[str, Any]:
    normalized_segments: list[dict[str, Any]] = []
    normalized_words: list[dict[str, Any]] = []
    for segment in raw.get("segments", []):
        words = []
        for word in segment.get("words", []):
            text = word["word"].strip()
            if not text:
                continue
            normalized = {
                "startSec": round(float(word["start"]), 3),
                "endSec": round(float(word["end"]), 3),
                "text": text,
                "confidence": round(float(word.get("probability", 0.0)), 4),
            }
            words.append(normalized)
            normalized_words.append(normalized)
        normalized_segments.append(
            {
                "id": segment["id"],
                "startSec": round(float(segment["start"]), 3),
                "endSec": round(float(segment["end"]), 3),
                "text": segment["text"].strip(),
                "words": words,
            }
        )
    duration = float(raw.get("duration_seconds") or 0.0)
    if normalized_words:
        covered_start = min(word["startSec"] for word in normalized_words)
        covered_end = max(word["endSec"] for word in normalized_words)
        coverage_seconds = max(0.0, covered_end - covered_start)
        average_confidence = sum(word["confidence"] for word in normalized_words) / len(normalized_words)
    else:
        covered_start = covered_end = coverage_seconds = average_confidence = 0.0
    return {
        "schemaVersion": 1,
        "source": {"sha256": raw["audio_sha256"], "durationSeconds": duration},
        "language": raw.get("language"),
        "segments": normalized_segments,
        "words": normalized_words,
        "metrics": {
            "wordCount": len(normalized_words),
            "coveredStartSec": round(covered_start, 3),
            "coveredEndSec": round(covered_end, 3),
            "coverageSeconds": round(coverage_seconds, 3),
            "coverageRatio": round(coverage_seconds / duration, 4) if duration else 0.0,
            "averageWordConfidence": round(average_confidence, 4),
        },
    }


def verify_cache(request_dir: Path) -> dict[str, Any]:
    required = [
        request_dir / "request.json",
        request_dir / "raw-transcript.json",
        request_dir / "normalized-lyrics.json",
        request_dir / "alignment-report.json",
    ]
    missing = [str(path) for path in required if not path.is_file() or path.stat().st_size == 0]
    report_path = request_dir / "alignment-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {}
    return {"complete": not missing, "missing": missing, "report": report}


def transcribe(
    audio: Path,
    cache_root: Path,
    model_name: str,
    language: str | None,
    device: str,
    compute_type: str,
) -> dict[str, Any]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError(
            "faster-whisper is not installed. Install backend/requirements-lyrics.txt first."
        ) from error

    audio_hash, request_hash = input_cache_key(audio, model_name, language, device, compute_type)
    request_dir = cache_root / audio_hash / request_hash
    existing = verify_cache(request_dir) if request_dir.exists() else {"complete": False, "missing": []}
    if request_dir.exists() and existing["complete"]:
        return existing["report"]
    if request_dir.exists() and any(request_dir.iterdir()):
        raise CacheConflict(f"Existing lyric cache is incomplete; refusing to overwrite: {request_dir}")

    request = {
        "created_at": utc_now(),
        "audio": {"path": str(audio), "sha256": audio_hash},
        "model": {
            "name": model_name,
            "language": language,
            "device": device,
            "compute_type": compute_type,
        },
        "options": {"word_timestamps": True, "vad_filter": False, "condition_on_previous_text": False},
    }
    atomic_write_json(request_dir / "request.json", request)

    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        str(audio),
        language=language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=False,
    )
    raw_segments = [segment_to_dict(segment) for segment in segments]
    raw = {
        "created_at": utc_now(),
        "audio_sha256": audio_hash,
        "model": model_name,
        "language": info.language,
        "language_probability": float(info.language_probability),
        "duration_seconds": float(info.duration),
        "duration_after_vad_seconds": float(getattr(info, "duration_after_vad", info.duration)),
        "segments": raw_segments,
    }
    atomic_write_json(request_dir / "raw-transcript.json", raw)
    normalized = normalize_transcript(raw)
    atomic_write_json(request_dir / "normalized-lyrics.json", normalized)
    metrics = normalized["metrics"]
    status = "candidate" if metrics["wordCount"] > 0 and metrics["averageWordConfidence"] >= 0.45 else "needs_review"
    report = {
        "schemaVersion": 1,
        "status": status,
        "automaticTranscriptOnly": True,
        "humanReviewRequired": True,
        "reason": "No reference lyric text was supplied; word accuracy cannot be measured automatically.",
        "audioSha256": audio_hash,
        "model": model_name,
        "language": raw["language"],
        "metrics": metrics,
        "createdAt": utc_now(),
    }
    atomic_write_json(request_dir / "alignment-report.json", report)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, required=True, help="Vocal stem to transcribe")
    parser.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    parser.add_argument("--model", default="small.en", help="faster-whisper model name")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--verify-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        audio_hash, request_hash = input_cache_key(args.audio, args.model, args.language, args.device, args.compute_type)
        request_dir = args.cache_root / audio_hash / request_hash
        if args.verify_only:
            result = verify_cache(request_dir)
            result["audioSha256"] = audio_hash
            result["requestHash"] = request_hash
        else:
            result = transcribe(args.audio, args.cache_root, args.model, args.language, args.device, args.compute_type)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result.get("status", "candidate") != "needs_review" or result.get("complete", False) else 1
    except (CacheConflict, FileNotFoundError, RuntimeError) as error:
        print(f"Lyric ASR stopped: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
