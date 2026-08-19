import unittest
import wave
from pathlib import Path

from backend.spike_a import JobSpec, request_cache_key, validate_source


class SpikeATests(unittest.TestCase):
  def test_request_cache_key_is_stable_and_parameter_sensitive(self):
    first = JobSpec("example", "example", {"a": "1"}, {}, "json")
    same = JobSpec("example", "example", {"a": "1"}, {}, "json")
    different = JobSpec("example", "example", {"a": "2"}, {}, "json")
    self.assertEqual(request_cache_key("abc", first), request_cache_key("abc", same))
    self.assertNotEqual(request_cache_key("abc", first), request_cache_key("abc", different))
    self.assertNotEqual(request_cache_key("abc", first), request_cache_key("def", first))


  def test_validate_source_requires_ten_to_fifteen_second_wav(self):
    clip = Path(self._testMethodName + ".wav")
    try:
      with wave.open(str(clip), "wb") as audio:
          audio.setnchannels(1)
          audio.setsampwidth(2)
          audio.setframerate(8000)
          audio.writeframes(b"\0\0" * (8000 * 12))
      source_hash, duration = validate_source(clip)
      self.assertEqual(len(source_hash), 64)
      self.assertEqual(duration, 12)
    finally:
      clip.unlink(missing_ok=True)


  def test_validate_source_rejects_wrong_duration(self):
    clip = Path(self._testMethodName + ".wav")
    try:
      with wave.open(str(clip), "wb") as audio:
          audio.setnchannels(1)
          audio.setsampwidth(2)
          audio.setframerate(8000)
          audio.writeframes(b"\0\0" * (8000 * 9))
      with self.assertRaisesRegex(RuntimeError, "between 10 and 15"):
          validate_source(clip)
    finally:
      clip.unlink(missing_ok=True)


if __name__ == "__main__":
  unittest.main()
