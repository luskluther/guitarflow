import type { Song } from "./lessonModel";

export type QaScenario = "uncertain-lyric" | "unsupported-chord" | "missing-rhythm" | "missing-audio" | "publication-blocked" | "capo-five" | "three-four";

export function applyQaScenario(source: Song, scenario: string | null): Song {
  const song = structuredClone(source);
  if (scenario === "uncertain-lyric") {
    const word = song.lyrics.segments[0]?.words[0];
    if (word) word.confidence = 0.1;
  }
  if (scenario === "unsupported-chord" && song.chordEvents[0]) {
    song.chordEvents[0] = {
      ...song.chordEvents[0],
      chord: "X?",
      displayName: "Unrecognized chord",
      poseId: "unsupported",
    };
  }
  if (scenario === "missing-rhythm") {
    song.beats = [];
    song.strumEvents = [];
  }
  if (scenario === "missing-audio") song.audio.guitarPath = "/assets/qa-missing-guitar-stem.wav";
  if (scenario === "publication-blocked") song.analysis.qualityGate = { status: "review_required", publicationBlocked: true, unresolvedFindingCount: 1 };
  if (scenario === "capo-five") song.metadata.capoFret = 5;
  if (scenario === "three-four") song.tempo = { bpm: 90, beatsPerBar: 3, beatUnit: 4 };
  return song;
}
