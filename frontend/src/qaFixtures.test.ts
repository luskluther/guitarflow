import { describe, expect, it } from "vitest";
import songFixture from "../public/song.json";
import type { Song } from "./lessonModel";
import { applyQaScenario } from "./qaFixtures";

const song = songFixture as Song;

describe("trust-state QA fixtures", () => {
  it("does not mutate the cached lesson source", () => {
    const before = JSON.stringify(song);
    applyQaScenario(song, "unsupported-chord");
    expect(JSON.stringify(song)).toBe(before);
  });

  it("forces only the requested uncertainty or missing evidence", () => {
    expect(applyQaScenario(song, "uncertain-lyric").lyrics.segments[0].words[0].confidence).toBe(0.1);
    expect(applyQaScenario(song, "unsupported-chord").chordEvents[0].chord).toBe("X?");
    expect(applyQaScenario(song, "missing-rhythm").beats).toEqual([]);
    expect(applyQaScenario(song, "missing-rhythm").strumEvents).toEqual([]);
    expect(applyQaScenario(song, "missing-audio").audio.guitarPath).toContain("qa-missing");
    expect(applyQaScenario(song, "publication-blocked").analysis.qualityGate?.publicationBlocked).toBe(true);
    expect(applyQaScenario(song, "capo-five").metadata.capoFret).toBe(5);
    expect(applyQaScenario(song, "three-four").tempo).toEqual({ bpm: 90, beatsPerBar: 3, beatUnit: 4 });
  });
});
