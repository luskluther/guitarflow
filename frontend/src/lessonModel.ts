export type ChordContext = { previous: string | null; current: string | null; next: string | null; nextChangeSec: number | null };
export type LyricWord = { startSec: number; endSec: number; text: string; confidence: number; chordContext: ChordContext };
export type LyricSegment = { id: number; startSec: number; endSec: number; text: string; words: LyricWord[] };
export type ChordEvent = { startSec: number; endSec: number; chord: string; displayName: string; poseId: string; context: ChordContext };
export type StrumEvent = { timeSec: number; direction: "U" | "D" };
export type BeatEvent = { timeSec: number; beat: number; derived?: boolean };
export type Voicing = { displayName: string; frets: Array<number | null>; fingers: number[] };
export type Phrase = { id: string; label: string; startSec: number; endSec: number };

export type Song = {
  metadata: { title: string; artist: string; mode: string; difficulty: string; key: string; capoFret?: number };
  audio: { durationSec: number; originalPath: string; backingPath: string; guitarPath: string };
  tempo: { bpm: number; beatsPerBar?: number; beatUnit?: number };
  lyrics: { segments: LyricSegment[]; words: LyricWord[] };
  chordEvents: ChordEvent[];
  strumEvents: StrumEvent[];
  beats: BeatEvent[];
  phrases: Phrase[];
  voicings: Record<string, Voicing>;
  analysis: {
    chordReport: { coverageRatio: number; beginnerSimplification: boolean; warning: string; corrections?: Array<{ timeSec: number; chord: string; reason: string }> };
    beatReport?: { providerCount: number; derivedCount: number; repairs: Array<{ timeSec: number; beat: number; reason: string }> };
    qualityGate?: { status: "pass" | "review_required"; publicationBlocked: boolean; unresolvedFindingCount: number; unresolvedFindings?: Array<Record<string, unknown>> };
  };
};

export const STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
export const LOW_LYRIC_CONFIDENCE = 0.65;
// Every shape uses the same player-view orientation as the hero fretboard:
// high e at the top and low E at the bottom.
export const CHORD_DIAGRAM_STRING_INDEXES = [0, 1, 2, 3, 4, 5] as const;
export const STRUM_BAR_PATTERN = [
  { beat: "1", direction: "D", motion: "D" },
  { beat: "e", direction: null, motion: "U" },
  { beat: "&", direction: "D", motion: "D" },
  { beat: "a", direction: "U", motion: "U" },
  { beat: "2", direction: null, motion: "D" },
  { beat: "e", direction: "U", motion: "U" },
  { beat: "&", direction: "D", motion: "D" },
  { beat: "a", direction: "U", motion: "U" },
] as const;
export const STRUM_BAR_STROKES = [
  { slotIndex: 0, beat: "1", direction: "D" },
  { slotIndex: 2, beat: "1&", direction: "D" },
  { slotIndex: 3, beat: "1a", direction: "U" },
  { slotIndex: 5, beat: "2e", direction: "U" },
  { slotIndex: 6, beat: "2&", direction: "D" },
  { slotIndex: 7, beat: "2a", direction: "U" },
] as const;

// Calibrated against fretboard-player-view-v1.png. Each entry is the x-position
// of the nut or fret wire as a percentage of the full hero width.
export const FRET_BOUNDARIES_PERCENT = [9.58, 20.32, 29.55, 37.92, 46.29, 54.21, 61.83, 69.04, 75.84, 82.40, 88.70, 94.86, 100] as const;

// The hero intentionally stretches the reference asset vertically to 170% so
// its neck has the same visual weight as the supplied product reference.
export const STRING_CENTERS_PERCENT = [21.6, 30.8, 40.0, 49.3, 58.5, 67.7] as const;

export function fretCenterPercent(fret: number) {
  if (!Number.isInteger(fret) || fret < 1 || fret > 12) throw new RangeError(`Unsupported fret: ${fret}`);
  return (FRET_BOUNDARIES_PERCENT[fret - 1] + FRET_BOUNDARIES_PERCENT[fret]) / 2;
}

export function capoAwareFret(relativeFret: number, capoFret = 0) {
  if (!Number.isInteger(relativeFret) || relativeFret < 1) throw new RangeError(`Unsupported relative fret: ${relativeFret}`);
  if (!Number.isInteger(capoFret) || capoFret < 0) throw new RangeError(`Unsupported capo fret: ${capoFret}`);
  const absoluteFret = relativeFret + capoFret;
  if (absoluteFret > 12) throw new RangeError(`Capo ${capoFret} places this shape beyond the 12-fret player view`);
  return absoluteFret;
}

export function getCountInSpec(song: Song, speed: number) {
  const beatsPerBar = Math.max(2, Math.min(12, Math.round(song.tempo.beatsPerBar ?? 4)));
  const safeSpeed = Math.max(0.25, speed);
  return {
    beatsPerBar,
    beatUnit: song.tempo.beatUnit ?? 4,
    beatWallSec: (60 / song.tempo.bpm) / safeSpeed,
    effectiveBpm: song.tempo.bpm * safeSpeed,
  };
}

export function getSongChordNames(song: Song) {
  return [...new Set(song.chordEvents.map((event) => event.chord).filter(Boolean))];
}

export function getSongPublicationIssue(song: Song) {
  const gate = song.analysis.qualityGate;
  if (!gate) return "The lesson has no musical publication-quality report.";
  if (gate.status !== "pass" || gate.publicationBlocked || gate.unresolvedFindingCount > 0) {
    return "The lesson has unresolved chord, rhythm, or timeline findings and cannot be opened.";
  }
  return null;
}

export function clampTime(song: Song, timeSec: number) {
  return Math.max(0, Math.min(song.audio.durationSec, timeSec));
}

export function getAudiblePresentationTime(song: Song, masterTimeSec: number, speed: number, outputDelaySec: number, playing: boolean) {
  // Positive values delay the visuals to match delayed audio output; negative
  // values intentionally lead the visuals for device-specific correction.
  const mediaDelay = playing ? outputDelaySec * speed : 0;
  return clampTime(song, masterTimeSec - mediaDelay);
}

export function getPhraseAtTime(song: Song, timeSec: number) {
  const time = clampTime(song, timeSec);
  return song.phrases.find((phrase) => time >= phrase.startSec && time < phrase.endSec) ?? song.phrases[0];
}

export function isLyricConfidenceLow(confidence: number | undefined, threshold = LOW_LYRIC_CONFIDENCE) {
  return Number.isFinite(confidence) && Number(confidence) < threshold;
}

export function getTransitionPreparation(nextChord: ChordEvent | undefined, timeSec: number, playing: boolean, leadSec = 0.8) {
  const secondsToNext = nextChord ? Math.max(0, nextChord.startSec - timeSec) : null;
  return {
    secondsToNext,
    preparing: Boolean(playing && secondsToNext !== null && secondsToNext > 0 && secondsToNext <= leadSec),
  };
}

export function getPresentationState(
  song: Song,
  masterTimeSec: number,
  speed: number,
  outputDelaySec: number,
  playing: boolean,
  previewTimeSec: number | null = null,
  loopPhrase?: Phrase,
) {
  const audibleTime = getAudiblePresentationTime(song, masterTimeSec, speed, outputDelaySec, playing);
  const unboundedTime = previewTimeSec === null ? audibleTime : clampTime(song, previewTimeSec);
  const displayTime = previewTimeSec === null && loopPhrase
    ? Math.max(loopPhrase.startSec, Math.min(loopPhrase.endSec, unboundedTime))
    : unboundedTime;
  const timeline = getTimelineState(song, displayTime);
  return {
    displayTime,
    isPreviewing: previewTimeSec !== null,
    timeline,
    transition: getTransitionPreparation(timeline.visualNextChord, displayTime, playing && previewTimeSec === null),
    strumBar: getStrumBarState(song, displayTime),
    phrase: loopPhrase ?? getPhraseAtTime(song, displayTime),
  };
}

export type LyricChordAnchor = { chord: string; timeSec: number; positionPct: number };

export function getLyricChordAnchor(
  chords: ChordEvent[],
  word: LyricWord,
  previousWord: LyricWord | undefined,
  isFirstWord: boolean,
): LyricChordAnchor | undefined {
  const changeInsideWord = chords.find((event) => event.startSec >= word.startSec && event.startSec < word.endSec);
  if (changeInsideWord) {
    const progress = (changeInsideWord.startSec - word.startSec) / Math.max(0.001, word.endSec - word.startSec);
    return {
      chord: changeInsideWord.chord,
      timeSec: changeInsideWord.startSec,
      positionPct: Math.max(0, Math.min(100, progress * 100)),
    };
  }

  const changeInGap = previousWord
    ? chords.find((event) => event.startSec >= previousWord.endSec && event.startSec < word.startSec)
    : undefined;
  if (changeInGap) return { chord: changeInGap.chord, timeSec: changeInGap.startSec, positionPct: 0 };

  if (isFirstWord) {
    const activeAtWord = chords.find((event) => word.startSec >= event.startSec && word.startSec < event.endSec);
    if (activeAtWord) return { chord: activeAtWord.chord, timeSec: activeAtWord.startSec, positionPct: 0 };
  }
  return undefined;
}

export function getStrumBarState(song: Song, timeSec: number) {
  const time = clampTime(song, timeSec);
  const beatOneEvents = song.beats.filter((beat) => beat.beat === 1);
  const barStart = beatOneEvents.reduce(
    (current, beat) => beat.timeSec <= time ? beat.timeSec : current,
    beatOneEvents[0]?.timeSec ?? 0,
  );
  // This recording plays the D-D-U-U-D-U figure over two quarter-note beats.
  // Eight visual slots are therefore sixteenth notes, not eighth notes.
  const subdivisionSec = (60 / song.tempo.bpm) / 4;
  const elapsed = Math.max(0, time - barStart);
  const cycleDurationSec = subdivisionSec * STRUM_BAR_PATTERN.length;
  const cycleElapsedSec = elapsed % cycleDurationSec;
  const activeIndex = Math.floor(cycleElapsedSec / subdivisionSec) % STRUM_BAR_PATTERN.length;
  const activeStrokeIndex = Math.max(0, STRUM_BAR_STROKES.reduce(
    (current, stroke, index) => stroke.slotIndex <= activeIndex ? index : current,
    -1,
  ));
  return {
    barStartSec: barStart,
    subdivisionSec,
    cycleDurationSec,
    cycleProgress: cycleElapsedSec / cycleDurationSec,
    activeIndex,
    activeStrokeIndex,
    step: STRUM_BAR_PATTERN[activeIndex],
  };
}

export function getTimelineState(song: Song, timeSec: number) {
  const time = clampTime(song, timeSec);
  const activeChordIndex = song.chordEvents.findIndex((event) => time >= event.startSec && time < event.endSec);
  const activeChord = activeChordIndex >= 0 ? song.chordEvents[activeChordIndex] : undefined;
  const previousChord = activeChordIndex > 0 ? song.chordEvents[activeChordIndex - 1] : undefined;
  const nextChord = activeChordIndex >= 0
    ? song.chordEvents[activeChordIndex + 1]
    : song.chordEvents.find((event) => event.startSec > time);
  const visualCurrentChord = activeChord ?? nextChord;
  const visualNextChord = activeChord
    ? nextChord
    : visualCurrentChord ? song.chordEvents.find((event) => event.startSec > visualCurrentChord.startSec) : undefined;
  const activeSegmentIndex = Math.max(0, song.lyrics.segments.reduce(
    (current, segment, index) => segment.startSec <= time ? index : current,
    -1,
  ));
  const currentStrumIndex = song.strumEvents.reduce(
    (current, strum, index) => strum.timeSec <= time ? index : current,
    -1,
  );

  return {
    time,
    activeChordIndex,
    activeChord,
    previousChord,
    nextChord,
    visualCurrentChord,
    visualNextChord,
    activeSegmentIndex,
    activeSegment: song.lyrics.segments[activeSegmentIndex],
    nextSegment: song.lyrics.segments[activeSegmentIndex + 1],
    currentStrumIndex,
    visibleStrumStart: Math.max(0, currentStrumIndex - 3),
  };
}
