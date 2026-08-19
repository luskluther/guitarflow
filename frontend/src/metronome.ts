export type MetronomeVoice = {
  type: OscillatorType;
  startHz: number;
  endHz: number;
  peakGain: number;
  attackSec: number;
  releaseSec: number;
};

export function metronomeVoices(accent: boolean): MetronomeVoice[] {
  return accent
    ? [
        { type: "square", startHz: 2200, endHz: 1600, peakGain: 0.38, attackSec: 0.0015, releaseSec: 0.032 },
        { type: "triangle", startHz: 1120, endHz: 720, peakGain: 0.29, attackSec: 0.002, releaseSec: 0.078 },
      ]
    : [
        { type: "square", startHz: 1680, endHz: 1250, peakGain: 0.27, attackSec: 0.0015, releaseSec: 0.028 },
        { type: "triangle", startHz: 820, endHz: 560, peakGain: 0.2, attackSec: 0.002, releaseSec: 0.068 },
      ];
}

export function scheduleMetronomeClick(context: AudioContext, when: number, accent: boolean) {
  return metronomeVoices(accent).map((voice) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.startHz, when);
    oscillator.frequency.exponentialRampToValueAtTime(voice.endHz, when + voice.releaseSec);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(voice.peakGain, when + voice.attackSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + voice.releaseSec);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + voice.releaseSec + 0.01);
    return oscillator;
  });
}
