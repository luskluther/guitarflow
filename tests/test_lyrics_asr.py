import unittest

from backend.lyrics_asr import normalize_transcript
from backend.lyrics_timeline import build_timeline


class LyricsAsrTests(unittest.TestCase):
    def test_normalize_transcript_preserves_word_timing_and_metrics(self):
        raw = {
            "audio_sha256": "abc",
            "duration_seconds": 10.0,
            "language": "en",
            "segments": [
                {
                    "id": 0,
                    "start": 1.0,
                    "end": 3.0,
                    "text": " hello world",
                    "words": [
                        {"start": 1.0, "end": 1.5, "word": " hello", "probability": 0.9},
                        {"start": 1.6, "end": 2.2, "word": " world", "probability": 0.8},
                    ],
                }
            ],
        }
        result = normalize_transcript(raw)
        self.assertEqual(result["words"][0]["text"], "hello")
        self.assertEqual(result["words"][1]["startSec"], 1.6)
        self.assertEqual(result["metrics"]["wordCount"], 2)
        self.assertEqual(result["metrics"]["coveredEndSec"], 2.2)
        self.assertEqual(result["metrics"]["averageWordConfidence"], 0.85)

    def test_normalize_transcript_handles_no_words(self):
        result = normalize_transcript(
            {"audio_sha256": "abc", "duration_seconds": 10.0, "language": "en", "segments": []}
        )
        self.assertEqual(result["metrics"]["wordCount"], 0)
        self.assertEqual(result["metrics"]["coverageRatio"], 0.0)

    def test_timeline_adds_previous_current_next_chords(self):
        lyrics = {
            "source": {"sha256": "abc"},
            "words": [
                {"startSec": 1.2, "endSec": 1.5, "text": "one", "confidence": 0.9},
                {"startSec": 2.2, "endSec": 2.5, "text": "two", "confidence": 0.9},
            ],
        }
        musical = {
            "key": "G major",
            "chords": [[0.0, 1.0, "N"], [1.0, 2.0, "G:maj"], [2.0, 3.0, "C:maj"]],
        }
        result = build_timeline(lyrics, musical)
        self.assertEqual(result["words"][0]["chordContext"]["current"], "G:maj")
        self.assertEqual(result["words"][0]["chordContext"]["next"], "C:maj")
        self.assertEqual(result["words"][1]["chordContext"]["previous"], "G:maj")


if __name__ == "__main__":
    unittest.main()
