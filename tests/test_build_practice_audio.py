import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

from backend.build_practice_audio import BACKING_STEMS, build_tracks


def write_test_wav(path: Path, value: float, frames: int = 20, sample_rate: int = 10) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    audio = np.full((frames, 2), value * 32767, dtype="<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(audio.tobytes())


class BuildPracticeAudioTests(unittest.TestCase):
    def test_build_tracks_stitches_windows_and_separates_guitar(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            roots = [Path(directory) / "first", Path(directory) / "second"]
            for index, root in enumerate(roots, start=1):
                stem_root = root / "source-separation" / "request" / "outputs" / "stems"
                write_test_wav(stem_root / "guitar.wav", 0.01 * index)
                for stem in BACKING_STEMS:
                    write_test_wav(stem_root / f"{stem}.wav", 0.005 * index)

            backing, guitar, sample_rate = build_tracks([(0, roots[0]), (2, roots[1])])

            self.assertEqual(sample_rate, 10)
            self.assertEqual(backing.shape, (40, 2))
            self.assertAlmostEqual(float(guitar[5, 0]), 0.01, places=3)
            self.assertAlmostEqual(float(guitar[25, 0]), 0.02, places=3)
            self.assertAlmostEqual(float(backing[5, 0]), 0.025, places=3)
            self.assertAlmostEqual(float(backing[25, 0]), 0.05, places=3)


if __name__ == "__main__":
    unittest.main()
