import json
import unittest
from pathlib import Path

from backend.build_song import CHORD_SHAPES, apply_audited_chord_corrections, apply_lyric_corrections, context_for_time, infer_beats_per_bar, infer_bpm, normalize_chord_name, repair_beat_grid, repair_zero_duration_words, snap_chord_boundaries_to_beats, words_with_chord_context
from backend.song_quality import build_quality_report, find_unexplained_chord_changes, structural_findings


class BuildSongTests(unittest.TestCase):
    def test_zero_duration_word_is_repaired_before_shared_boundary(self):
        words = [
            {"startSec": 13.06, "endSec": 13.64, "text": "point"},
            {"startSec": 13.9, "endSec": 13.9, "text": "a"},
            {"startSec": 13.9, "endSec": 14.26, "text": "fork"},
        ]
        repaired = repair_zero_duration_words(words)
        self.assertEqual(repaired[1]["startSec"], 13.82)
        self.assertEqual(repaired[1]["endSec"], 13.9)
        self.assertEqual(words[1]["startSec"], 13.9)

    def test_normalize_chord_names(self):
        self.assertEqual(normalize_chord_name("G:maj"), "G")
        self.assertEqual(normalize_chord_name("E:min"), "Em")

    def test_time_signature_uses_provider_beat_numbers(self):
        self.assertEqual(infer_beats_per_bar([{"beat": 1}, {"beat": 2}, {"beat": 3}]), 3)
        self.assertEqual(infer_beats_per_bar([{"beat": 1}, {"beat": 2}, {"beat": 3}, {"beat": 4}]), 4)
        self.assertEqual(infer_bpm([{"timeSec": 0.0}, {"timeSec": 0.625}, {"timeSec": 1.25}]), 96.0)

    def test_missing_window_edge_beat_is_repaired_in_sequence(self):
        beats = [{"timeSec": 13.5, "beat": 2.0}, {"timeSec": 14.11, "beat": 3.0}, {"timeSec": 15.35, "beat": 1.0}]
        repaired, report = repair_beat_grid(beats, 4)
        self.assertIn({"timeSec": 14.73, "beat": 4.0, "derived": True}, repaired)
        self.assertTrue(any(item["timeSec"] == 14.73 and item["beat"] == 4 for item in report))

    def test_beat_grid_restores_leading_downbeat_and_trailing_count(self):
        beats = [{"timeSec": 0.94, "beat": 2.0}, {"timeSec": 1.57, "beat": 3.0}, {"timeSec": 2.2, "beat": 4.0}]
        repaired, report = repair_beat_grid(beats, 4, duration_sec=2.9)
        self.assertEqual(repaired[0], {"timeSec": 0.31, "beat": 1.0, "derived": True})
        self.assertEqual(repaired[-1], {"timeSec": 2.83, "beat": 1.0, "derived": True})
        self.assertEqual([item["beat"] for item in report], [1, 1])

    def test_context_has_previous_current_next(self):
        chords = [
            {"startSec": 0.0, "endSec": 2.0, "chord": "G"},
            {"startSec": 2.0, "endSec": 4.0, "chord": "C"},
            {"startSec": 4.0, "endSec": 6.0, "chord": "D"},
        ]
        self.assertEqual(context_for_time(chords, 2.5), {"previous": "G", "current": "C", "next": "D", "nextChangeSec": 4.0})

    def test_open_chord_shapes_use_high_e_to_low_e_order(self):
        self.assertEqual(CHORD_SHAPES["G"]["frets"], [3, 0, 0, 0, 2, 3])
        self.assertEqual(CHORD_SHAPES["C"]["frets"], [0, 1, 0, 2, 3, None])
        self.assertEqual(CHORD_SHAPES["D"]["frets"], [2, 3, 2, 0, None, None])
        self.assertEqual(CHORD_SHAPES["Em"]["frets"], [0, 0, 0, 2, 2, 0])

    def test_nested_lyric_words_receive_chord_context(self):
        chords = [
            {"startSec": 0.0, "endSec": 2.0, "chord": "G"},
            {"startSec": 2.0, "endSec": 4.0, "chord": "C"},
        ]
        words = [{"startSec": 2.25, "endSec": 2.5, "text": "word"}]

        enriched = words_with_chord_context(chords, words)

        self.assertEqual(enriched[0]["chordContext"]["current"], "C")
        self.assertEqual(enriched[0]["chordContext"]["previous"], "G")

    def test_window_edge_chord_boundary_snaps_to_audible_beat(self):
        chords = [
            {"startSec": 11.481, "endSec": 15.0, "chord": "G"},
            {"startSec": 15.0, "endSec": 16.481, "chord": "D"},
        ]
        beats = [{"timeSec": 15.35, "beat": 1.0}]
        snapped = snap_chord_boundaries_to_beats(chords, beats)
        self.assertEqual(snapped[0]["endSec"], 15.35)
        self.assertEqual(snapped[1]["startSec"], 15.35)
        self.assertEqual(chords[1]["startSec"], 15.0)

    def test_audited_correction_restores_fork_stuck_change_without_mutating_provider_events(self):
        provider = [
            {"startSec": 11.58, "endSec": 15.35, "chord": "G"},
            {"startSec": 15.35, "endSec": 16.61, "chord": "D"},
        ]
        corrected = apply_audited_chord_corrections(provider)
        self.assertEqual(
            corrected,
            [
                {"startSec": 11.58, "endSec": 14.11, "chord": "G"},
                {"startSec": 14.11, "endSec": 15.35, "chord": "C"},
                {"startSec": 15.35, "endSec": 16.61, "chord": "D"},
            ],
        )
        self.assertEqual(provider[0], {"startSec": 11.58, "endSec": 15.35, "chord": "G"})

    def test_known_asr_word_correction_stays_in_derived_model(self):
        corrected = apply_lyric_corrections([{"text": "rest,", "startSec": 1.0, "endSec": 1.2}])
        self.assertEqual(corrected[0]["text"], "wrist,")

    def test_audio_quality_gate_detects_provider_miss_and_accepts_reviewed_boundary(self):
        root = Path(__file__).resolve().parents[1]
        song = json.loads((root / "data" / "song.json").read_text(encoding="utf-8"))
        guitar = root / "frontend" / "public" / "fixtures" / "guitar.wav"
        raw = []
        for event in song["chordEvents"]:
            if event["chord"] == "C" and abs(event["startSec"] - 14.11) < 0.001:
                raw[-1]["endSec"] = event["endSec"]
                continue
            raw.append(dict(event))

        findings = find_unexplained_chord_changes(raw, song["beats"], guitar)
        self.assertTrue(any(item["timeSec"] == 14.11 and item["candidateChord"] == "C" for item in findings))
        blocked_report = build_quality_report({**song, "chordEvents": raw}, guitar, raw)
        self.assertEqual(blocked_report["status"], "review_required")
        self.assertTrue(blocked_report["publicationBlocked"])
        report = build_quality_report(song, guitar, raw)
        self.assertEqual(report["status"], "pass")
        self.assertFalse(report["publicationBlocked"])
        self.assertEqual(report["unresolvedFindingCount"], 0)

    def test_publication_structure_requires_time_signature_and_continuous_chords(self):
        song = {
            "audio": {"durationSec": 4},
            "tempo": {"bpm": 96, "beatsPerBar": 4, "beatUnit": 4},
            "beats": [{"timeSec": 1, "beat": 1}, {"timeSec": 2, "beat": 2}],
            "chordEvents": [
                {"startSec": 0, "endSec": 2, "chord": "G"},
                {"startSec": 2.2, "endSec": 4, "chord": "C"},
            ],
        }
        self.assertTrue(any("gap or overlap" in finding for finding in structural_findings(song)))
        song["metadata"] = {"mode": "Notes", "capoFret": 0}
        self.assertTrue(any("note-level lesson" in finding for finding in structural_findings(song)))
