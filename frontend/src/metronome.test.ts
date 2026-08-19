import { describe, expect, it, vi } from "vitest";
import { metronomeVoices, scheduleMetronomeClick } from "./metronome";

describe("audible metronome click", () => {
  it("uses a bright transient plus a longer body for every beat", () => {
    const regular = metronomeVoices(false);
    const accent = metronomeVoices(true);
    expect(regular).toHaveLength(2);
    expect(accent).toHaveLength(2);
    expect(regular.map((voice) => voice.type)).toEqual(["square", "triangle"]);
    expect(accent[0].startHz).toBeGreaterThan(regular[0].startHz);
    expect(accent.reduce((sum, voice) => sum + voice.peakGain, 0)).toBeGreaterThan(regular.reduce((sum, voice) => sum + voice.peakGain, 0));
    expect(Math.max(...regular.map((voice) => voice.releaseSec))).toBeGreaterThanOrEqual(0.06);
  });

  it("schedules both audible voices at the requested audio-clock time", () => {
    const starts: number[] = [];
    const stops: number[] = [];
    const frequencies = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    const gains = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    const context = {
      destination: {},
      createOscillator: () => ({
        type: "sine",
        frequency: frequencies,
        connect: vi.fn().mockReturnThis(),
        start: (when: number) => starts.push(when),
        stop: (when: number) => stops.push(when),
      }),
      createGain: () => ({ gain: gains, connect: vi.fn().mockReturnThis() }),
    } as unknown as AudioContext;

    const sources = scheduleMetronomeClick(context, 4.25, true);

    expect(sources).toHaveLength(2);
    expect(starts).toEqual([4.25, 4.25]);
    expect(stops.every((when) => when > 4.25)).toBe(true);
    expect(gains.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
  });
});
