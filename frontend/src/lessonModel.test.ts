import { describe, expect, it } from "vitest";
import songFixture from "../public/song.json";
import {
  CHORD_DIAGRAM_STRING_INDEXES,
  FRET_BOUNDARIES_PERCENT,
  STRUM_BAR_PATTERN,
  STRUM_BAR_STROKES,
  STRING_CENTERS_PERCENT,
  STRING_LABELS,
  capoAwareFret,
  fretCenterPercent,
  getAudiblePresentationTime,
  getCountInSpec,
  getLyricChordAnchor,
  getPhraseAtTime,
  getPresentationState,
  getSongChordNames,
  getSongPublicationIssue,
  getStrumBarState,
  getTimelineState,
  getTransitionPreparation,
  isLyricConfidenceLow,
  type Song,
} from "./lessonModel";

const song = songFixture as Song;

describe("fretboard projection contract", () => {
  it("keeps the hero and chord diagrams in the same high-to-low player view", () => {
    expect(STRING_LABELS).toEqual(["e", "B", "G", "D", "A", "E"]);
    expect(CHORD_DIAGRAM_STRING_INDEXES).toEqual([0, 1, 2, 3, 4, 5]);
    expect(STRING_CENTERS_PERCENT).toHaveLength(6);
    expect([...STRING_CENTERS_PERCENT]).toEqual([...STRING_CENTERS_PERCENT].sort((a, b) => a - b));
  });

  it("projects markers into the calibrated perspective fret cells", () => {
    for (let fret = 1; fret <= 12; fret += 1) {
      const center = fretCenterPercent(fret);
      expect(center).toBeGreaterThan(FRET_BOUNDARIES_PERCENT[fret - 1]);
      expect(center).toBeLessThan(FRET_BOUNDARIES_PERCENT[fret]);
      expect(center).toBeCloseTo((FRET_BOUNDARIES_PERCENT[fret - 1] + FRET_BOUNDARIES_PERCENT[fret]) / 2, 6);
    }
    expect(fretCenterPercent(1)).toBeCloseTo(14.95, 2);
    expect(fretCenterPercent(2)).toBeCloseTo(24.935, 3);
    expect(fretCenterPercent(3)).toBeCloseTo(33.735, 3);
  });

  it("rejects fret positions outside the rendered neck", () => {
    expect(() => fretCenterPercent(0)).toThrow(RangeError);
    expect(() => fretCenterPercent(13)).toThrow(RangeError);
  });

  it("moves relative chord shapes above a capo while preserving player-view geometry", () => {
    expect(capoAwareFret(1, 5)).toBe(6);
    expect(capoAwareFret(3, 5)).toBe(8);
    expect(fretCenterPercent(capoAwareFret(3, 5))).toBeGreaterThan(fretCenterPercent(3));
    expect(() => capoAwareFret(3, 10)).toThrow(/beyond the 12-fret player view/);
  });
});

describe("count-in and continuous hand motion", () => {
  it("lists every song chord once in first-use order", () => {
    expect(getSongChordNames(song)).toEqual(["G", "C", "D", "Em"]);
  });

  it("uses one bar of the song time signature at the speed-adjusted BPM", () => {
    expect(getCountInSpec(song, 1)).toEqual({ beatsPerBar: 4, beatUnit: 4, beatWallSec: 0.625, effectiveBpm: 96 });
    const threeFour = { ...song, tempo: { bpm: 90, beatsPerBar: 3, beatUnit: 4 } };
    expect(getCountInSpec(threeFour, 0.5)).toEqual({ beatsPerBar: 3, beatUnit: 4, beatWallSec: 4 / 3, effectiveBpm: 45 });
  });

  it("publishes a continuous metronome beat grid across provider windows", () => {
    const beatIndex = song.beats.findIndex((beat) => beat.timeSec === 14.73);
    expect(song.beats[beatIndex]).toMatchObject({ beat: 4, derived: true });
    expect(song.beats[beatIndex - 1]).toMatchObject({ timeSec: 14.11, beat: 3 });
    expect(song.beats[beatIndex + 1]).toMatchObject({ timeSec: 15.35, beat: 1 });
    for (let index = 1; index < song.beats.length; index += 1) {
      expect(song.beats[index].beat).toBe((song.beats[index - 1].beat % 4) + 1);
    }
  });

  it("keeps the hand moving through both non-contact slots", () => {
    expect(STRUM_BAR_PATTERN[1]).toMatchObject({ direction: null, motion: "U" });
    expect(STRUM_BAR_PATTERN[4]).toMatchObject({ direction: null, motion: "D" });
    expect(STRUM_BAR_PATTERN.every((step) => step.motion === "U" || step.motion === "D")).toBe(true);
  });
});

describe("musical publication gate", () => {
  it("opens only lessons with a passing zero-unresolved quality report", () => {
    expect(getSongPublicationIssue(song)).toBeNull();
    expect(getSongPublicationIssue({ ...song, analysis: { ...song.analysis, qualityGate: undefined } })).toMatch(/no musical publication-quality report/);
    expect(getSongPublicationIssue({ ...song, analysis: { ...song.analysis, qualityGate: { status: "review_required", publicationBlocked: true, unresolvedFindingCount: 1 } } })).toMatch(/cannot be opened/);
  });
});

describe("beginner voicing truth table", () => {
  const expected = {
    G: { frets: [3, 0, 0, 0, 2, 3], fingers: [3, 0, 0, 0, 1, 2] },
    C: { frets: [0, 1, 0, 2, 3, null], fingers: [0, 1, 0, 2, 3, 0] },
    D: { frets: [2, 3, 2, 0, null, null], fingers: [2, 3, 1, 0, 0, 0] },
    Em: { frets: [0, 0, 0, 2, 2, 0], fingers: [0, 0, 0, 3, 2, 0] },
  };

  for (const [chord, voicing] of Object.entries(expected)) {
    it(`keeps ${chord} on the approved six-string shape`, () => {
      expect(song.voicings[chord].frets).toEqual(voicing.frets);
      expect(song.voicings[chord].fingers).toEqual(voicing.fingers);
      expect(song.voicings[chord].frets).toHaveLength(6);
      expect(song.voicings[chord].fingers).toHaveLength(6);
    });
  }
});

describe("single timeline selectors", () => {
  it("targets the sounding phrase for loop activation", () => {
    expect(getPhraseAtTime(song, 0)?.id).toBe("phrase-1");
    expect(getPhraseAtTime(song, 20)?.id).toBe("phrase-2");
    expect(getPhraseAtTime(song, 22)?.id).toBe("phrase-3");
    expect(getPhraseAtTime(song, 29)?.id).toBe("phrase-4");
  });

  it("returns one coherent cross-widget state at 12 seconds", () => {
    const state = getTimelineState(song, 12);
    expect(state.activeChord?.chord).toBe("G");
    expect(state.previousChord?.chord).toBe("D");
    expect(state.visualNextChord?.chord).toBe("C");
    expect(state.activeSegment?.words.some((word) => word.text.toLowerCase().includes("turn"))).toBe(true);
    expect(song.strumEvents[state.currentStrumIndex].timeSec).toBeLessThanOrEqual(12);
  });

  it("converts hardware output delay into speed-aware media presentation time", () => {
    expect(getAudiblePresentationTime(song, 15.02, 0.5, 0.09, true)).toBeCloseTo(14.975, 6);
    expect(getAudiblePresentationTime(song, 15.02, 1, 0.09, true)).toBeCloseTo(14.93, 6);
    expect(getAudiblePresentationTime(song, 15.02, 1, -0.04, true)).toBeCloseTo(15.06, 6);
    expect(getAudiblePresentationTime(song, 15.02, 0.5, 0.09, false)).toBe(15.02);
  });

  it("positions a chord change continuously inside the timed lyric word", () => {
    const segment = song.lyrics.segments[0];
    const wordIndex = segment.words.findIndex((word) => word.text === "road");
    const anchor = getLyricChordAnchor(song.chordEvents, segment.words[wordIndex], segment.words[wordIndex - 1], false);
    expect(anchor?.chord).toBe("D");
    expect(anchor?.timeSec).toBe(15.35);
    expect(anchor?.positionPct).toBeCloseTo(29.07, 2);
  });

  it("places every vocal-section chord boundary on a visible lyric anchor", () => {
    const anchors = song.lyrics.segments.flatMap((segment) => segment.words.map((word, index) => (
      getLyricChordAnchor(song.chordEvents, word, segment.words[index - 1], index === 0)
    )).filter((anchor) => anchor !== undefined));
    const firstVocalChord = song.chordEvents.find((event) => event.startSec <= song.lyrics.words[0].startSec && event.endSec > song.lyrics.words[0].startSec);
    const vocalEvents = song.chordEvents.filter((event) => event.startSec >= (firstVocalChord?.startSec ?? song.lyrics.words[0].startSec));
    for (const event of vocalEvents) {
      expect(anchors.some((anchor) => anchor.chord === event.chord && anchor.timeSec === event.startSec), `${event.chord} at ${event.startSec}s`).toBe(true);
    }
    for (const cBoundary of [19.11, 24.16, 29.18]) {
      expect(anchors.some((anchor) => anchor.chord === "C" && anchor.timeSec === cBoundary)).toBe(true);
    }
  });

  it("changes every chord-driven widget after the audited fork-stuck correction", () => {
    expect(getTimelineState(song, 14.109).activeChord?.chord).toBe("G");
    expect(getTimelineState(song, 14.11).activeChord?.chord).toBe("C");
    expect(getTimelineState(song, 15.349).activeChord?.chord).toBe("C");
    expect(getTimelineState(song, 15.35).activeChord?.chord).toBe("D");
  });

  it("exposes only evidence-backed lyric uncertainty", () => {
    expect(isLyricConfidenceLow(0.64)).toBe(true);
    expect(isLyricConfidenceLow(0.65)).toBe(false);
    expect(isLyricConfidenceLow(undefined)).toBe(false);
  });

  it("prepares the next chord only inside the playback lead window", () => {
    const next = song.chordEvents.find((event) => event.startSec === 16.61);
    expect(getTransitionPreparation(next, 15.8, true).preparing).toBe(false);
    expect(getTransitionPreparation(next, 15.81, true).preparing).toBe(true);
    expect(getTransitionPreparation(next, 16.2, false).preparing).toBe(false);
    expect(getTransitionPreparation(next, 16.61, true).preparing).toBe(false);
  });

  it("switches every chord consumer atomically at every boundary and speed", () => {
    const outputDelaySec = 0.14;
    for (const speed of [0.5, 0.75, 1]) {
      for (let index = 1; index < song.chordEvents.length; index += 1) {
        const boundary = song.chordEvents[index].startSec;
        const delayedMasterBoundary = boundary + outputDelaySec * speed;
        const before = getPresentationState(song, delayedMasterBoundary - 0.001, speed, outputDelaySec, true);
        const at = getPresentationState(song, delayedMasterBoundary, speed, outputDelaySec, true);
        const after = getPresentationState(song, delayedMasterBoundary + 0.001, speed, outputDelaySec, true);

        expect(before.timeline.activeChord?.chord).toBe(song.chordEvents[index - 1].chord);
        expect(at.timeline.activeChord?.chord).toBe(song.chordEvents[index].chord);
        expect(after.timeline.activeChord?.chord).toBe(song.chordEvents[index].chord);
        expect(at.timeline.visualCurrentChord?.poseId).toBe(song.chordEvents[index].poseId);
        expect(at.displayTime).toBeCloseTo(boundary, 6);
      }
    }
  });

  it("promotes every upcoming chord within 800ms without resetting presentation state", () => {
    for (const speed of [0.5, 0.75, 1]) {
      for (let index = 1; index < song.chordEvents.length; index += 1) {
        const boundary = song.chordEvents[index].startSec;
        const availableLead = boundary - song.chordEvents[index - 1].startSec;
        const lead = Math.min(0.7, availableLead - 0.01);
        const masterTime = boundary - lead + 0.14 * speed;
        const state = getPresentationState(song, masterTime, speed, 0.14, true);
        expect(state.transition.preparing).toBe(true);
        expect(state.transition.secondsToNext).toBeCloseTo(lead, 6);
        expect(state.timeline.visualNextChord?.chord).toBe(song.chordEvents[index].chord);
      }
    }
  });

  it("freezes all preview consumers on the requested seek time", () => {
    const preview = getPresentationState(song, 4, 0.5, 0.14, true, 22.5);
    expect(preview.isPreviewing).toBe(true);
    expect(preview.displayTime).toBe(22.5);
    expect(preview.timeline.activeChord?.chord).toBe("Em");
    expect(preview.transition.preparing).toBe(false);
    expect(preview.strumBar).toEqual(getStrumBarState(song, 22.5));
  });

  it("never exposes stale pre-loop state after a compensated wrap", () => {
    for (const phrase of song.phrases) {
      for (const speed of [0.5, 0.75, 1]) {
        const state = getPresentationState(song, phrase.startSec, speed, 0.14, true, null, phrase);
        expect(state.displayTime).toBe(phrase.startSec);
        expect(state.phrase.id).toBe(phrase.id);
      }
    }
  });

  it("keeps one fixed strum bar while only the active slot loops", () => {
    expect(STRUM_BAR_PATTERN.map((step) => step.direction)).toEqual(["D", null, "D", "U", null, "U", "D", "U"]);
    expect(STRUM_BAR_PATTERN.map((step) => step.beat)).toEqual(["1", "e", "&", "a", "2", "e", "&", "a"]);
    expect(STRUM_BAR_STROKES.map((step) => step.direction).join(" ")).toBe("D D U U D U");
    expect(getStrumBarState(song, 12.84).activeIndex).toBe(0);
    expect(getStrumBarState(song, 13.5).activeIndex).toBe(4);
    expect(getStrumBarState(song, 13.5).activeStrokeIndex).toBe(2);
    expect(getStrumBarState(song, 15.35).activeIndex).toBe(0);
    expect(getStrumBarState(song, 15.35).cycleDurationSec).toBe(1.25);
    expect(getStrumBarState(song, 15.35).cycleProgress).toBeCloseTo(0, 6);
    expect(getStrumBarState(song, 15.68).activeStrokeIndex).toBe(1);
    expect(getStrumBarState(song, 15.85).activeStrokeIndex).toBe(2);
    expect(getStrumBarState(song, 16.17).activeStrokeIndex).toBe(3);
    expect(getStrumBarState(song, 16.33).activeStrokeIndex).toBe(4);
    expect(getStrumBarState(song, 16.46).activeStrokeIndex).toBe(5);
  });

  it("keeps chord intervals continuous after the analyzed pre-roll", () => {
    for (let index = 1; index < song.chordEvents.length; index += 1) {
      expect(song.chordEvents[index - 1].endSec).toBe(song.chordEvents[index].startSec);
    }
    expect(song.chordEvents.at(-1)?.endSec).toBe(song.audio.durationSec);
  });

  it("keeps all lyric words bounded and context-enriched", () => {
    expect(song.lyrics.words).toHaveLength(39);
    for (const word of song.lyrics.words) {
      expect(word.startSec).toBeGreaterThanOrEqual(0);
      expect(word.endSec).toBeGreaterThan(word.startSec);
      expect(word.endSec).toBeLessThanOrEqual(song.audio.durationSec);
      expect(word.chordContext.current).not.toBeNull();
    }
    for (const segment of song.lyrics.segments) {
      expect(segment.words.map((word) => word.text).join(" ").replaceAll(" ,", ",")).toContain(segment.text.split(" ")[0]);
      for (const word of segment.words) {
        expect(word.startSec).toBeGreaterThanOrEqual(segment.startSec);
        expect(word.endSec).toBeLessThanOrEqual(segment.endSec);
      }
    }
  });
});
