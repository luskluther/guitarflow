"""Run GuitarFlow Spike A against one short audio clip.

The runner is deliberately cache-first. A source clip is identified by its
SHA-256, and each provider request is identified by the source hash, endpoint,
and normalized parameters. Existing request directories are never overwritten.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import shutil
import sys
import time
import wave
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


BASE_URL = "https://api.klang.io"
DEFAULT_CACHE_ROOT = Path("data/cache/klangio")
POLLABLE_STATUSES = {"IN_QUEUE", "IN_PROGRESS"}
STEMS = ("vocals", "bass", "drums", "piano", "guitar", "other")


@dataclass(frozen=True)
class JobSpec:
    name: str
    endpoint: str
    query: dict[str, str]
    data: dict[str, list[str]]
    result_kind: str


JOB_SPECS = (
    JobSpec("beat-tracking", "beat-tracking", {}, {}, "json"),
    JobSpec(
        "chord-recognition-extended",
        "chord-recognition-extended",
        {"vocabulary": "major-minor"},
        {},
        "json",
    ),
    JobSpec(
        "source-separation",
        "source-separation",
        {"model": "six-stems", "output": "wav"},
        {},
        "stems",
    ),
    JobSpec(
        "transcription",
        "transcription",
        {"model": "universal"},
        {"outputs": ["midi"]},
        "midi",
    ),
)


class CacheConflict(RuntimeError):
    """Raised when an existing cache entry is incomplete or inconsistent."""


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


def request_cache_key(source_hash: str, spec: JobSpec) -> str:
    payload = {
        "source_sha256": source_hash,
        "endpoint": spec.endpoint,
        "query": spec.query,
        "data": spec.data,
    }
    return sha256_bytes(canonical_json(payload).encode("utf-8"))


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


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip("\"'")
    return values


def get_setting(name: str, env_file: Path) -> str | None:
    return os.environ.get(name) or load_env_file(env_file).get(name)


def require_network_permission(env_file: Path, allow_network: bool) -> str:
    api_key = get_setting("KLANGIO_API_KEY", env_file)
    if not api_key or api_key == "replace-with-klangio-api-key":
        raise RuntimeError(f"KLANGIO_API_KEY is missing in {env_file}")
    if not allow_network:
        raise RuntimeError("Network is disabled. Re-run with --allow-network for the deliberate Spike A pass.")
    if (get_setting("KLANGIO_NETWORK_ENABLED", env_file) or "").lower() != "true":
        raise RuntimeError("KLANGIO_NETWORK_ENABLED must be true for the deliberate Spike A pass.")
    return api_key


def wav_duration_seconds(path: Path) -> float:
    if path.suffix.lower() != ".wav":
        raise RuntimeError("Spike A requires a WAV clip so duration can be verified without extra media tools.")
    with wave.open(str(path), "rb") as audio:
        if audio.getframerate() <= 0:
            raise RuntimeError(f"Invalid WAV sample rate: {path}")
        return audio.getnframes() / audio.getframerate()


def validate_source(path: Path, min_duration: float = 10.0, max_duration: float = 15.0) -> tuple[str, float]:
    if not path.is_file():
        raise FileNotFoundError(f"Audio clip not found: {path}")
    source_hash = sha256_file(path)
    duration = wav_duration_seconds(path)
    if not min_duration <= duration <= max_duration:
        raise RuntimeError(
            f"Clip duration must be between {min_duration:g} and {max_duration:g} seconds; "
            f"received {duration:.3f} seconds."
        )
    return source_hash, duration


def safe_response_headers(response: requests.Response) -> dict[str, str]:
    allowed = {"content-type", "content-length", "date", "etag", "x-request-id"}
    return {key: value for key, value in response.headers.items() if key.lower() in allowed}


def save_response(directory: Path, response: requests.Response) -> None:
    atomic_write_bytes(directory / "response.raw", response.content)
    metadata = {
        "status_code": response.status_code,
        "headers": safe_response_headers(response),
        "saved_at": utc_now(),
    }
    atomic_write_json(directory / "response-meta.json", metadata)
    if "json" in response.headers.get("content-type", "").lower():
        try:
            atomic_write_json(directory / "response.json", response.json())
        except ValueError:
            pass


def post_job(source: Path, api_key: str, spec: JobSpec, job_dir: Path) -> dict[str, Any]:
    create_dir = job_dir / "create"
    request_metadata = {
        "created_at": utc_now(),
        "endpoint": spec.endpoint,
        "query": spec.query,
        "data": spec.data,
        "source_filename": source.name,
        "source_sha256": sha256_file(source),
        "request_headers": {"kl-api-key": "[redacted]"},
    }
    atomic_write_json(job_dir / "request.json", request_metadata)
    content_type = mimetypes.guess_type(source.name)[0] or "audio/wav"
    with source.open("rb") as audio:
        response = requests.post(
            f"{BASE_URL}/{spec.endpoint}",
            headers={"kl-api-key": api_key},
            params=spec.query,
            data=[(key, value) for key, values in spec.data.items() for value in values],
            files={"file": (source.name, audio, content_type)},
            timeout=120,
        )
    save_response(create_dir, response)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("job_id"):
        raise RuntimeError(f"Klangio response did not include job_id for {spec.name}")
    return payload


def poll_job(job_id: str, api_key: str, job_dir: Path, timeout_seconds: int, poll_interval: float) -> dict[str, Any]:
    status_dir = job_dir / "status"
    started = time.monotonic()
    attempt = 0
    while True:
        response = requests.get(
            f"{BASE_URL}/job/{job_id}/status",
            headers={"kl-api-key": api_key},
            timeout=60,
        )
        attempt += 1
        attempt_dir = status_dir / f"{attempt:04d}"
        save_response(attempt_dir, response)
        response.raise_for_status()
        payload = response.json()
        status = payload.get("status")
        if status == "COMPLETED":
            return payload
        if status == "FAILED":
            raise RuntimeError(f"Klangio job {job_id} failed; see {attempt_dir}")
        if status not in POLLABLE_STATUSES:
            raise RuntimeError(f"Unexpected Klangio job status {status!r}; see {attempt_dir}")
        if time.monotonic() - started > timeout_seconds:
            raise TimeoutError(f"Timed out waiting for Klangio job {job_id}; see {status_dir}")
        time.sleep(poll_interval)


def fetch_result(job_id: str, api_key: str, spec: JobSpec, job_dir: Path) -> list[Path]:
    output_dir = job_dir / "outputs"
    saved: list[Path] = []
    if spec.result_kind == "json":
        response = requests.get(f"{BASE_URL}/job/{job_id}/json", headers={"kl-api-key": api_key}, timeout=120)
        result_dir = job_dir / "result"
        save_response(result_dir, response)
        response.raise_for_status()
        saved.append(result_dir / "response.raw")
    elif spec.result_kind == "midi":
        response = requests.get(f"{BASE_URL}/job/{job_id}/midi", headers={"kl-api-key": api_key}, timeout=120)
        result_dir = job_dir / "result"
        save_response(result_dir, response)
        response.raise_for_status()
        midi_path = output_dir / "transcription.mid"
        atomic_write_bytes(midi_path, response.content)
        saved.append(midi_path)
    elif spec.result_kind == "stems":
        for stem in STEMS:
            response = requests.get(
                f"{BASE_URL}/job/{job_id}/audio",
                params={"stem_type": stem},
                headers={"kl-api-key": api_key},
                timeout=120,
            )
            stem_dir = job_dir / "result" / stem
            save_response(stem_dir, response)
            response.raise_for_status()
            stem_path = output_dir / "stems" / f"{stem}.wav"
            atomic_write_bytes(stem_path, response.content)
            saved.append(stem_path)
    else:
        raise ValueError(f"Unknown result kind: {spec.result_kind}")
    return saved


def verify_job_cache(job_dir: Path, spec: JobSpec) -> list[str]:
    missing: list[str] = []
    required = [job_dir / "request.json", job_dir / "create" / "response.raw"]
    status_files = list((job_dir / "status").glob("*/response.raw")) if (job_dir / "status").exists() else []
    if not status_files:
        missing.append(str(job_dir / "status" / "<attempt>" / "response.raw"))
    required.extend(status_files[-1:] if status_files else [])
    if spec.result_kind in {"json", "midi"}:
        required.append(job_dir / "result" / "response.raw")
    elif spec.result_kind == "stems":
        required.extend(job_dir / "result" / stem / "response.raw" for stem in STEMS)
        required.extend(job_dir / "outputs" / "stems" / f"{stem}.wav" for stem in STEMS)
    for path in required:
        if not path.is_file() or path.stat().st_size == 0:
            missing.append(str(path))
    if spec.result_kind == "midi" and not (job_dir / "outputs" / "transcription.mid").is_file():
        missing.append(str(job_dir / "outputs" / "transcription.mid"))
    return missing


def verify_cache(
    source: Path,
    cache_root: Path,
    min_duration: float = 10.0,
    max_duration: float = 15.0,
) -> dict[str, Any]:
    source_hash, duration = validate_source(source, min_duration, max_duration)
    root = cache_root / source_hash
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return {"source_sha256": source_hash, "duration_seconds": duration, "complete": False, "missing": [str(manifest_path)]}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    missing: list[str] = []
    cached_source = next((root / "source").glob("*"), None) if (root / "source").exists() else None
    if not cached_source or sha256_file(cached_source) != source_hash:
        missing.append(str(root / "source"))
    for spec in JOB_SPECS:
        request_dir = root / spec.name / request_cache_key(source_hash, spec)
        missing.extend(verify_job_cache(request_dir, spec))
    return {
        "source_sha256": source_hash,
        "duration_seconds": duration,
        "manifest": manifest,
        "complete": not missing,
        "missing": missing,
    }


def run_spike_a(
    source: Path,
    cache_root: Path,
    api_key: str,
    timeout_seconds: int,
    poll_interval: float,
    min_duration: float = 10.0,
    max_duration: float = 15.0,
) -> dict[str, Any]:
    source_hash, duration = validate_source(source, min_duration, max_duration)
    root = cache_root / source_hash
    root.mkdir(parents=True, exist_ok=True)
    cached_source = root / "source" / source.name
    if cached_source.exists():
        if sha256_file(cached_source) != source_hash:
            raise CacheConflict(f"Cached source differs from input: {cached_source}")
    else:
        cached_source.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, cached_source)
    manifest = {
        "spike": "A",
        "source": {"filename": source.name, "sha256": source_hash, "duration_seconds": duration},
        "provider": {"name": "Klangio", "base_url": BASE_URL},
        "started_at": utc_now(),
        "jobs": [],
    }
    write_json(root / "manifest.json", manifest)
    for spec in JOB_SPECS:
        cache_key = request_cache_key(source_hash, spec)
        job_dir = root / spec.name / cache_key
        existing_manifest = job_dir / "request.json"
        if existing_manifest.exists():
            raise CacheConflict(f"Existing request cache must not be reused for a fresh network pass: {job_dir}")
        print(f"Submitting {spec.name}...")
        create_payload = post_job(source, api_key, spec, job_dir)
        job_id = create_payload["job_id"]
        final_status = poll_job(job_id, api_key, job_dir, timeout_seconds, poll_interval)
        outputs = fetch_result(job_id, api_key, spec, job_dir)
        missing = verify_job_cache(job_dir, spec)
        if missing:
            raise CacheConflict(f"Cache verification failed for {spec.name}: {missing}")
        manifest["jobs"].append(
            {
                "name": spec.name,
                "endpoint": spec.endpoint,
                "request_cache_key": cache_key,
                "job_id": job_id,
                "final_status": final_status,
                "outputs": [str(path.relative_to(root)) for path in outputs],
            }
        )
        write_json(root / "manifest.json", manifest)
    manifest["completed_at"] = utc_now()
    write_json(root / "manifest.json", manifest)
    verification = verify_cache(source, cache_root, min_duration, max_duration)
    atomic_write_json(root / "spike-a-verification.json", verification)
    if not verification["complete"]:
        raise CacheConflict(f"Final cache verification failed: {verification['missing']}")
    return verification


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, required=True, help="One short WAV clip")
    parser.add_argument("--allow-network", action="store_true", help="Explicitly permit the one deliberate provider pass")
    parser.add_argument("--verify-only", action="store_true", help="Verify existing cache artifacts without network access")
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    parser.add_argument("--timeout-seconds", type=int, default=900)
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--min-duration", type=float, default=10.0)
    parser.add_argument("--max-duration", type=float, default=15.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.verify_only:
            result = verify_cache(args.audio, args.cache_root, args.min_duration, args.max_duration)
        else:
            api_key = require_network_permission(args.env_file, args.allow_network)
            result = run_spike_a(
                args.audio,
                args.cache_root,
                api_key,
                args.timeout_seconds,
                args.poll_interval,
                args.min_duration,
                args.max_duration,
            )
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result.get("complete") else 1
    except (CacheConflict, FileNotFoundError, RuntimeError, TimeoutError, requests.RequestException) as error:
        print(f"Spike A stopped: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
