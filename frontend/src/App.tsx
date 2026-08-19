import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CHORD_DIAGRAM_STRING_INDEXES,
  STRUM_BAR_PATTERN,
  STRING_CENTERS_PERCENT,
  STRING_LABELS,
  capoAwareFret,
  clampTime,
  fretCenterPercent,
  getCountInSpec,
  getLyricChordAnchor,
  getPhraseAtTime,
  getPresentationState,
  getSongChordNames,
  getSongPublicationIssue,
  isLyricConfidenceLow,
  type ChordEvent,
  type LyricSegment,
  type Song,
  type Voicing,
} from "./lessonModel";
import { applyQaScenario } from "./qaFixtures";
import { scheduleMetronomeClick } from "./metronome";

type MixMode = "original" | "practice";
type PoseState = "current" | "next";
type TransportIconName = "previous" | "restart" | "play" | "pause" | "next" | "loop" | "metronome" | "more" | "close";
type StrumCue = { arrow: string; short: string; label: string };

const speedOptions = [1, 0.75, 0.5];
function formatTime(seconds: number, precise = false) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remaining = precise ? (safe % 60).toFixed(1).padStart(4, "0") : String(Math.floor(safe % 60)).padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function displayStrum(direction: "U" | "D") {
  return direction === "D" ? { arrow: "↓", short: "D", label: "Down" } : { arrow: "↑", short: "U", label: "Up" };
}

function displayHandMotion(direction: "U" | "D") {
  return direction === "D"
    ? { arrow: "⇣", short: "○", label: "Move down · miss strings" }
    : { arrow: "⇡", short: "○", label: "Move up · miss strings" };
}

function TransportIcon({ name }: { name: TransportIconName }) {
  if (name === "play") return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="icon-fill" d="m8.5 6.4 9 5.6-9 5.6z" /></svg>;
  if (name === "pause") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10" /></svg>;
  if (name === "previous") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5v11M17.5 7.5 10.5 12l7 4.5z" /></svg>;
  if (name === "next") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 6.5v11M6.5 7.5l7 4.5-7 4.5z" /></svg>;
  if (name === "restart") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 8.1H3.8V4.7M4.2 8a8 8 0 1 1-.1 7.8" /></svg>;
  if (name === "loop") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.1 8.2A6.8 6.8 0 0 1 18.7 10M17 6.8l1.8 3.3 2.7-2.4M16.9 15.8A6.8 6.8 0 0 1 5.3 14M7 17.2l-1.8-3.3-2.7 2.4" /></svg>;
  if (name === "metronome") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 20 2-15h4l2 15zM12 8l3 7M6 20h12" /></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1" className="icon-fill" /><circle cx="12" cy="12" r="1" className="icon-fill" /><circle cx="12" cy="19" r="1" className="icon-fill" /></svg>;
}

function ChordDiagram({ chord, voicing, muted = false, capoFret = 0 }: { chord?: string | null; voicing?: Voicing; muted?: boolean; capoFret?: number }) {
  if (!chord) return <div className={`mini-diagram empty ${muted ? "muted" : ""}`}>—</div>;
  if (!voicing) return <div className={`mini-diagram unavailable ${muted ? "muted" : ""}`}>Shape unavailable</div>;
  if (voicing.frets.length !== 6 || voicing.fingers.length !== 6) return <div className={`mini-diagram unavailable ${muted ? "muted" : ""}`}>Shape unavailable</div>;
  return (
    <div className={`mini-diagram ${muted ? "muted" : ""}`} aria-label={`${voicing.displayName} chord diagram, player view with high e at top and low E at bottom${capoFret ? `, shape relative to capo ${capoFret}` : ""}`}>
      <div className="diagram-frets">
        {CHORD_DIAGRAM_STRING_INDEXES.map((index) => {
          const fret = voicing.frets[index];
          return (
            <span className="diagram-string" key={`${chord}-${index}`}>
              <b>{STRING_LABELS[index]}</b>
              <em>{fret === null ? "×" : fret === 0 ? "○" : ""}</em>
              {fret !== null && fret > 0 ? <i style={{ left: `${(fret - 0.5) * 25}%` }}>{voicing.fingers[index]}</i> : null}
            </span>
          );
        })}
      </div>
      <small>1&nbsp;&nbsp;2&nbsp;&nbsp;3&nbsp;&nbsp;4</small>
    </div>
  );
}

function PoseMarkers({ chord, voicing, state, capoFret = 0 }: { chord?: string; voicing?: Voicing; state: PoseState; capoFret?: number }) {
  if (!chord || !voicing || voicing.frets.length !== 6 || voicing.fingers.length !== 6) return null;
  return (
    <div className={`pose-layer pose-${state}`} aria-label={`${state} hand pose for ${voicing.displayName}`}>
      {voicing.frets.map((fret, stringIndex) => fret !== null && fret > 0 ? (
        <span className="fret-finger" style={{ left: `${fretCenterPercent(capoAwareFret(fret, capoFret))}%`, top: `${STRING_CENTERS_PERCENT[stringIndex]}%` }} key={`${state}-${chord}-${stringIndex}`}>{voicing.fingers[stringIndex]}</span>
      ) : null)}
    </div>
  );
}

function Fretboard({ current, next, voicings, preparing, currentCue, secondsToNext, complete = false, capoFret = 0 }: { current?: ChordEvent; next?: ChordEvent; voicings: Record<string, Voicing>; preparing: boolean; currentCue: StrumCue; secondsToNext: number | null; complete?: boolean; capoFret?: number }) {
  return (
    <section className="fretboard-wrap" aria-label="Player-view fretboard">
      <div className="fretboard-meta">
        <span><b>PLAYER VIEW</b><small>high e at top · low E at bottom{capoFret ? ` · capo ${capoFret}` : ""}</small></span>
        <strong>{complete ? "Lesson complete · replay when ready" : `Place fingers for ${current?.displayName ?? "the first chord"}`}</strong>
        <span className={`prepare-note ${preparing ? "is-visible" : ""}`}>{preparing && next ? `Prepare ${next.displayName}` : "Current position"}</span>
      </div>
      <div className="fretboard">
        <div className="string-labels">{STRING_LABELS.map((label, index) => <span style={{ top: `${STRING_CENTERS_PERCENT[index]}%` }} key={`${label}-${index}`}>{label}</span>)}</div>
        <div className="fret-numbers">{Array.from({ length: 12 }, (_, index) => <span style={{ left: `${fretCenterPercent(index + 1)}%` }} key={index}>{index + 1}</span>)}</div>
        {capoFret ? <i className="capo-bar" style={{ left: `${fretCenterPercent(capoFret)}%` }} aria-label={`Capo at fret ${capoFret}`}><b>{capoFret}</b></i> : null}
        {preparing ? <PoseMarkers chord={next?.chord} voicing={next ? voicings[next.chord] : undefined} state="next" capoFret={capoFret} /> : null}
        <PoseMarkers chord={current?.chord} voicing={current ? voicings[current.chord] : undefined} state="current" capoFret={capoFret} />
        <aside className={`fretboard-guidance ${preparing ? "is-preparing" : ""} ${capoFret >= 4 ? "is-capo-position" : ""}`} aria-label="Current chord, hand motion, and next chord">
          <section className="guidance-now" aria-label="Authoritative current chord">
            <span>{complete ? "DONE" : "NOW"}</span><strong>{complete ? "✓" : current?.chord ?? "—"}</strong><small>{complete ? "Complete" : current?.displayName ?? "Ready"}</small>
          </section>
          <section className="guidance-stroke" aria-live="polite"><span>HAND</span><strong>{currentCue.arrow}</strong><b>{currentCue.label}</b></section>
          <section className="guidance-next"><span>NEXT</span><strong>{next?.chord ?? "End"}</strong><small>{secondsToNext !== null ? `in ${secondsToNext.toFixed(1)}s` : "Lesson complete"}</small></section>
        </aside>
      </div>
    </section>
  );
}

function LyricLine({ segment, time, active, chordEvents }: { segment?: LyricSegment; time: number; active: boolean; chordEvents: ChordEvent[] }) {
  if (!segment) return <div className="lyric-line next-line">Instrumental</div>;
  return (
    <div className={`lyric-line ${active ? "current-line" : "next-line"}`}>
      {segment.words.map((word, index) => {
        const anchor = getLyricChordAnchor(chordEvents, word, segment.words[index - 1], index === 0);
        const state = time >= word.endSec ? "passed" : time >= word.startSec ? "active-word" : "upcoming";
        const progress = state === "active-word" ? Math.max(0, Math.min(1, (time - word.startSec) / Math.max(0.001, word.endSec - word.startSec))) : 0;
        const uncertain = isLyricConfidenceLow(word.confidence);
        return (
          <span className={`lyric-token ${active ? state : "upcoming"} ${uncertain ? "is-uncertain" : ""}`} title={uncertain ? "Automatic lyric — lower confidence" : undefined} key={`${word.startSec}-${word.text}`}>
            <span className="word-copy">
              {word.text}
              {anchor ? <b className="word-chord" data-chord-time={anchor.timeSec.toFixed(3)} style={{ left: `${anchor.positionPct}%` }}>{anchor.chord}</b> : null}
              {active && state === "active-word" ? <i className="word-caret" style={{ left: `${progress * 100}%` }} /> : null}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function FingerNumberLegend() {
  return (
    <div className="finger-number-legend" aria-label="Finger numbers: 1 index, 2 middle, 3 ring, 4 pinky">
      <svg viewBox="0 0 88 70" role="img" aria-hidden="true">
        <path d="M25 60c-4-8-7-17-7-25 0-4 2-6 5-6 2 0 4 1 5 4V15c0-4 2-6 5-6s5 2 5 6v15-20c0-4 2-6 5-6s5 2 5 6v20-17c0-4 2-6 5-6s5 2 5 6v20-12c0-4 2-6 5-6s5 2 5 6v23c0 10-5 19-13 25" />
        {[[33, 13, "1"], [43, 8, "2"], [53, 11, "3"], [63, 20, "4"]].map(([x, y, number]) => (
          <g key={number}><circle cx={x} cy={y} r="7" /><text x={x} y={Number(y) + 3}>{number}</text></g>
        ))}
      </svg>
      <span><strong>FINGERS 1–4</strong><small>index → pinky</small></span>
    </div>
  );
}

function SongChordLibrary({ chords, voicings, currentChord, capoFret = 0 }: { chords: string[]; voicings: Record<string, Voicing>; currentChord?: string; capoFret?: number }) {
  return (
    <aside className="song-chord-library" aria-label="Chords used in this song">
      <header><span>CHORDS IN SONG</span><small>Player view</small></header>
      <div className="song-chord-reference">
        <div className="song-chord-list">
          {chords.map((chord) => {
            const voicing = voicings[chord];
            const current = chord === currentChord;
            return (
              <article className={`song-chord-card ${current ? "is-current" : ""}`} aria-current={current ? "true" : undefined} key={chord}>
                <span><strong>{chord}</strong><small>{voicing?.displayName ?? "Shape unavailable"}</small></span>
                <ChordDiagram chord={chord} voicing={voicing} muted={!current} capoFret={capoFret} />
              </article>
            );
          })}
        </div>
        <FingerNumberLegend />
      </div>
    </aside>
  );
}

function App() {
  const [song, setSong] = useState<Song | null>(null);
  const [loadError, setLoadError] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [selectedPhraseId, setSelectedPhraseId] = useState("");
  const [mixMode, setMixMode] = useState<MixMode>("original");
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [outputLatencySec, setOutputLatencySec] = useState(0);
  const [syncAdjustmentMs, setSyncAdjustmentMs] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const backingRef = useRef<HTMLAudioElement | null>(null);
  const guitarRef = useRef<HTMLAudioElement | null>(null);
  const metronomeContextRef = useRef<AudioContext | null>(null);
  const metronomeScheduledRef = useRef(new Set<string>());
  const metronomeLastTimeRef = useRef(0);
  const countInOscillatorsRef = useRef<OscillatorNode[]>([]);
  const countInRunRef = useRef(0);
  const latencyMeasuredRef = useRef(false);
  const resumeAfterSeekRef = useRef(false);

  useEffect(() => {
    const qaParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
    if (qaParams?.get("qa") === "model-error") {
      setLoadError("The cached lesson model is unavailable. Verify the local lesson cache, then retry.");
      return;
    }
    fetch("/song.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Lesson model failed to load (${response.status})`);
        return response.json();
      })
      .then(async (model: Song) => {
        const qaDelay = Number(qaParams?.get("delay"));
        if (Number.isFinite(qaDelay) && qaDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, Math.min(qaDelay, 5000)));
        const qaScenario = qaParams?.get("qa") ?? null;
        const lesson = applyQaScenario(model, qaScenario);
        const publicationIssue = getSongPublicationIssue(lesson);
        if (publicationIssue) throw new Error(publicationIssue);
        setSong(lesson);
        const qaLoop = qaParams?.get("loop");
        const initialPhraseId = qaLoop && lesson.phrases.some((phrase) => phrase.id === qaLoop) ? qaLoop : lesson.phrases[0]?.id ?? "";
        setSelectedPhraseId(initialPhraseId);
        if (qaLoop && initialPhraseId === qaLoop) setLoopEnabled(true);
        const qaSpeed = Number(qaParams?.get("speed"));
        if (speedOptions.includes(qaSpeed)) setSpeed(qaSpeed);
        const qaMode = qaParams?.get("mode");
        if (qaMode === "original" || qaMode === "practice") setMixMode(qaMode);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  useEffect(() => () => {
    countInRunRef.current += 1;
    void metronomeContextRef.current?.close();
  }, []);

  useEffect(() => {
    if (!song || !import.meta.env.DEV) return;
    const qaTime = Number(new URLSearchParams(window.location.search).get("at"));
    if (!Number.isFinite(qaTime) || qaTime <= 0) return;
    const clamped = clampTime(song, qaTime);
    if (backingRef.current) backingRef.current.currentTime = clamped;
    if (guitarRef.current) guitarRef.current.currentTime = clamped;
    setTime(clamped);
  }, [song]);

  const selectedPhrase = useMemo(() => song?.phrases.find((phrase) => phrase.id === selectedPhraseId), [song, selectedPhraseId]);

  useEffect(() => {
    const guitarLevel = mixMode === "original" ? 1 : 0;
    for (const audio of [backingRef.current, guitarRef.current]) if (audio) audio.playbackRate = speed;
    if (backingRef.current) backingRef.current.volume = 1;
    if (guitarRef.current) guitarRef.current.volume = guitarLevel;
  }, [speed, mixMode, song]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const backing = backingRef.current;
      const guitar = guitarRef.current;
      if (!backing || !guitar) return;
      if (loopEnabled && selectedPhrase && backing.currentTime >= selectedPhrase.endSec) {
        backing.currentTime = selectedPhrase.startSec;
        guitar.currentTime = selectedPhrase.startSec;
      }
      if (Math.abs(guitar.currentTime - backing.currentTime) > 0.045) guitar.currentTime = backing.currentTime;
      setTime(backing.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loopEnabled, selectedPhrase]);

  useEffect(() => {
    if (!playing || !metronomeEnabled || !song) {
      metronomeScheduledRef.current.clear();
      return;
    }
    const schedule = () => {
      const backing = backingRef.current;
      const context = metronomeContextRef.current;
      if (!backing || !context || context.state !== "running") return;
      const nowMedia = backing.currentTime;
      if (nowMedia + 0.08 < metronomeLastTimeRef.current) metronomeScheduledRef.current.clear();
      metronomeLastTimeRef.current = nowMedia;
      const scheduleThrough = nowMedia + 0.18 * speed;
      for (const beat of song.beats) {
        if (beat.timeSec < nowMedia - 0.015 || beat.timeSec > scheduleThrough) continue;
        const key = beat.timeSec.toFixed(3);
        if (metronomeScheduledRef.current.has(key)) continue;
        metronomeScheduledRef.current.add(key);
        const when = context.currentTime + Math.max(0.008, (beat.timeSec - nowMedia) / speed);
        scheduleMetronomeClick(context, when, Number(beat.beat) === 1);
      }
    };
    schedule();
    const timer = window.setInterval(schedule, 40);
    return () => window.clearInterval(timer);
  }, [playing, metronomeEnabled, song, speed, loopEnabled]);

  const setTransportTime = (nextTime: number) => {
    if (!song) return;
    const clamped = clampTime(song, nextTime);
    if (backingRef.current) backingRef.current.currentTime = clamped;
    if (guitarRef.current) guitarRef.current.currentTime = clamped;
    setTime(clamped);
  };

  const pausePlayback = () => {
    backingRef.current?.pause();
    guitarRef.current?.pause();
    setPlaying(false);
  };

  const ensureMetronomeContext = async () => {
    const context = metronomeContextRef.current ?? new AudioContext();
    metronomeContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    return context;
  };

  const cancelCountIn = () => {
    countInRunRef.current += 1;
    for (const oscillator of countInOscillatorsRef.current) {
      try { oscillator.stop(); } catch { /* It may already have ended. */ }
    }
    countInOscillatorsRef.current = [];
    setCountInBeat(null);
  };

  const runCountIn = async () => {
    if (!song || !metronomeEnabled) return true;
    const context = await ensureMetronomeContext();
    const run = ++countInRunRef.current;
    const { beatsPerBar, beatWallSec } = getCountInSpec(song, speed);
    const startAt = context.currentTime + 0.08;
    countInOscillatorsRef.current = [];
    setCountInBeat(1);
    for (let index = 0; index < beatsPerBar; index += 1) {
      countInOscillatorsRef.current.push(...scheduleMetronomeClick(context, startAt + index * beatWallSec, index === 0));
      window.setTimeout(() => {
        if (countInRunRef.current === run) setCountInBeat(index + 1);
      }, Math.max(0, (startAt - context.currentTime + index * beatWallSec) * 1000));
    }
    await new Promise((resolve) => window.setTimeout(resolve, Math.ceil((startAt - context.currentTime + beatsPerBar * beatWallSec) * 1000)));
    if (countInRunRef.current !== run) return false;
    countInOscillatorsRef.current = [];
    setCountInBeat(null);
    return true;
  };

  const handleMediaError = () => {
    pausePlayback();
    setLoadError("A cached practice track could not be loaded. Check the local fixture files, then retry.");
  };

  const startPlayback = async () => {
    const backing = backingRef.current;
    const guitar = guitarRef.current;
    if (!backing || !guitar || !song) return;
    backing.playbackRate = speed;
    guitar.playbackRate = speed;
    backing.volume = 1;
    guitar.volume = mixMode === "original" ? 1 : 0;
    if (!loopEnabled && (backing.ended || backing.currentTime >= song.audio.durationSec - 0.01)) setTransportTime(0);
    if (loopEnabled && selectedPhrase && (backing.currentTime < selectedPhrase.startSec || backing.currentTime >= selectedPhrase.endSec)) setTransportTime(selectedPhrase.startSec);
    guitar.currentTime = backing.currentTime;
    try {
      const shouldCountIn = metronomeEnabled && !loopEnabled && backing.currentTime <= 0.05;
      if (shouldCountIn) {
        if (!(await runCountIn())) return;
        const firstDownbeat = song.beats.find((beat) => Number(beat.beat) === 1)?.timeSec ?? 0;
        if (firstDownbeat > 0) setTransportTime(firstDownbeat);
      }
      if (metronomeEnabled) await ensureMetronomeContext();
      if (!latencyMeasuredRef.current) {
        latencyMeasuredRef.current = true;
        try {
          const context = new AudioContext();
          const measured = context.outputLatency || context.baseLatency || 0;
          setOutputLatencySec(Math.max(0, Math.min(0.12, measured)));
          await context.close();
        } catch {
          // Keep the conservative default when probing is unavailable.
        }
      }
      await Promise.all([backing.play(), guitar.play()]);
      setPlaying(true);
    } catch {
      pausePlayback();
      setLoadError("Audio playback could not start. Refresh the page and try again.");
    }
  };

  const togglePlayback = () => countInBeat !== null ? cancelCountIn() : playing ? pausePlayback() : void startPlayback();

  const toggleMetronome = async () => {
    const next = !metronomeEnabled;
    setMetronomeEnabled(next);
    metronomeScheduledRef.current.clear();
    if (!next) cancelCountIn();
    else {
      const context = await ensureMetronomeContext();
      countInOscillatorsRef.current.push(...scheduleMetronomeClick(context, context.currentTime + 0.025, true));
    }
  };
  const selectCurrentPhrase = () => {
    if (!song) return;
    const phrase = getPhraseAtTime(song, seekPreviewTime ?? time);
    if (phrase) {
      setSelectedPhraseId(phrase.id);
      setLoopEnabled(true);
    }
  };
  const toggleLoopAtCurrentTime = () => loopEnabled ? setLoopEnabled(false) : selectCurrentPhrase();

  const beginSeek = () => {
    if (seekPreviewTime !== null) return;
    resumeAfterSeekRef.current = playing;
    if (playing) pausePlayback();
    setSeekPreviewTime(time);
  };
  const previewSeek = (nextTime: number) => song && setSeekPreviewTime(clampTime(song, nextTime));
  const commitSeek = () => {
    if (seekPreviewTime === null) return;
    const shouldResume = resumeAfterSeekRef.current;
    setTransportTime(seekPreviewTime);
    setSeekPreviewTime(null);
    resumeAfterSeekRef.current = false;
    if (shouldResume) requestAnimationFrame(() => void startPlayback());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
      if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key.toLowerCase() === "l") {
        toggleLoopAtCurrentTime();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        setTransportTime(time + (event.key === "ArrowLeft" ? -2 : 2));
      } else if (event.key === "+" || event.key === "=") {
        setSpeed((value) => speedOptions[Math.max(0, speedOptions.indexOf(value) - 1)]);
      } else if (event.key === "-") {
        setSpeed((value) => speedOptions[Math.min(speedOptions.length - 1, speedOptions.indexOf(value) + 1)]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (loadError && !song) return <div className="loading error-state"><b>GuitarFlow could not open this lesson.</b><span>{loadError}</span><button type="button" onClick={() => window.location.reload()}>Retry lesson</button></div>;
  if (!song) return <div className="loading">Loading cached lesson…</div>;

  const audibleDelaySec = outputLatencySec + syncAdjustmentMs / 1000;
  const syncOffsetMs = Math.round(audibleDelaySec * 1000);
  const syncOffsetLabel = syncOffsetMs > 0 ? `${syncOffsetMs}ms delay` : syncOffsetMs < 0 ? `${Math.abs(syncOffsetMs)}ms lead` : "0ms";
  const presentation = getPresentationState(song, time, speed, audibleDelaySec, playing, seekPreviewTime, loopEnabled ? selectedPhrase : undefined);
  const { displayTime, timeline, transition, strumBar } = presentation;
  const activePhrase = presentation.phrase;
  const { activeChord, visualCurrentChord, visualNextChord, activeSegment, nextSegment } = timeline;
  const instructionChord = activeChord ?? visualCurrentChord;
  const lessonComplete = displayTime >= song.audio.durationSec - 0.01 && !instructionChord;
  const { secondsToNext, preparing } = transition;
  const rhythmAvailable = song.beats.length > 0 && song.strumEvents.length > 0;
  const strumCue = rhythmAvailable && strumBar.step.direction ? displayStrum(strumBar.step.direction) : null;
  const handCue = rhythmAvailable ? strumCue ?? displayHandMotion(strumBar.step.motion) : { arrow: "—", short: "—", label: "Rhythm unknown" };
  const nextHandStep = STRUM_BAR_PATTERN[(strumBar.activeIndex + 1) % STRUM_BAR_PATTERN.length];
  const nextHandCue = rhythmAvailable ? nextHandStep.direction ? displayStrum(nextHandStep.direction) : displayHandMotion(nextHandStep.motion) : null;
  const coverage = Math.round(song.analysis.chordReport.coverageRatio * 100);
  const effectiveGuitarLevel = mixMode === "original" ? 1 : 0;
  const songChordNames = getSongChordNames(song);
  const seekSegmentText = activeSegment?.words.map((word) => word.text).join(" ") ?? "Instrumental";
  const loopStartPct = selectedPhrase ? (selectedPhrase.startSec / song.audio.durationSec) * 100 : 0;
  const loopEndPct = selectedPhrase ? (selectedPhrase.endSec / song.audio.durationSec) * 100 : 0;
  const timelineStyle = { "--loop-start": `${loopStartPct}%`, "--loop-end": `${loopEndPct}%` } as CSSProperties;
  const strumStyle = { "--strum-progress": `${strumBar.cycleProgress * 100}%` } as CSSProperties;

  const jumpChord = (direction: -1 | 1) => {
    const candidates = direction < 0 ? song.chordEvents.filter((event) => event.startSec < time - 0.15) : song.chordEvents.filter((event) => event.startSec > time + 0.15);
    const target = direction < 0 ? candidates.at(-1) : candidates[0];
    setTransportTime(target?.startSec ?? (direction < 0 ? 0 : song.audio.durationSec));
  };
  const restartPlayback = () => {
    const wasPlaying = playing;
    if (wasPlaying) pausePlayback();
    setTransportTime(loopEnabled && selectedPhrase ? selectedPhrase.startSec : 0);
    if (wasPlaying) requestAnimationFrame(() => void startPlayback());
  };
  const handleBackingEnded = () => {
    if (loopEnabled && selectedPhrase) {
      setTransportTime(selectedPhrase.startSec);
      void startPlayback();
      return;
    }
    guitarRef.current?.pause();
    setPlaying(false);
    setTime(song.audio.durationSec);
  };

  return (
    <main className="app-shell isolate selection:bg-flow-accent/20 selection:text-flow-ink" tabIndex={-1} data-time={time.toFixed(3)} data-presentation-time={displayTime.toFixed(3)} data-lyric-time={displayTime.toFixed(3)} data-current-chord={instructionChord?.chord ?? ""} data-next-chord={visualNextChord?.chord ?? ""} data-strum-index={strumBar.activeIndex} data-loop-start={loopEnabled && selectedPhrase ? selectedPhrase.startSec : undefined} data-loop-end={loopEnabled && selectedPhrase ? selectedPhrase.endSec : undefined} data-metronome={metronomeEnabled ? "on" : "off"} data-count-in={countInBeat ?? undefined} data-capo-fret={song.metadata.capoFret ?? 0} data-song-chord-count={songChordNames.length}>
      <audio data-track="backing" ref={backingRef} src={song.audio.backingPath} preload="auto" onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onSeeked={(event) => setTime(event.currentTarget.currentTime)} onEnded={handleBackingEnded} onError={handleMediaError} />
      <audio data-track="guitar" data-effective-level={effectiveGuitarLevel} ref={guitarRef} src={song.audio.guitarPath} preload="auto" onError={handleMediaError} />

      <header className="topbar">
        <div className="brand-mark" aria-label="GuitarFlow lesson"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8.5 5.5h9l6 6v15h-15z" /><path d="M17.5 5.5v6h6M16 15v8M12 19h8" /></svg></div>
        <div className="song-heading"><h1>{song.metadata.title}</h1><p>{song.metadata.artist}</p></div>
        <div className="lesson-meta" aria-label="Lesson metadata"><span className="trust-chip" title="Lyrics and chords were generated automatically from cached analysis">Auto analysis</span><span className="quality-chip" title="Timeline structure and cached guitar-audio audit passed">QA checked</span><span>Beginner</span><span>Chords</span><span>{song.metadata.capoFret ? `Capo ${song.metadata.capoFret}` : "No capo"}</span></div>
        <div className="header-actions">
          <label className="speed-control"><span>Speed</span><select aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{speedOptions.map((option) => <option value={option} key={option}>{Math.round(option * 100)}%</option>)}</select></label>
          <button type="button" aria-pressed={loopEnabled} className={`header-loop ${loopEnabled ? "is-active" : ""}`} onClick={toggleLoopAtCurrentTime} title="Loop the current phrase"><TransportIcon name="loop" /><span>Loop</span><b>{loopEnabled ? "On" : "Off"}</b></button>
          <button type="button" aria-pressed={metronomeEnabled} className={`header-metronome ${metronomeEnabled ? "is-active" : ""}`} onClick={() => void toggleMetronome()} title="Audible count-in and beat ticks"><TransportIcon name="metronome" /><span>Metronome</span><b>{metronomeEnabled ? "Tick on" : "Off"}</b></button>
          <div className="more-wrap">
            <button type="button" className="icon-button" aria-label="More options" aria-expanded={moreOpen} aria-controls="lesson-details" onClick={() => setMoreOpen((value) => !value)}><TransportIcon name="more" /></button>
            {moreOpen ? (
              <aside className="lesson-details" id="lesson-details" aria-label="Lesson details">
                <div><strong>Automatic lesson analysis</strong><button type="button" className="icon-button compact" aria-label="Close lesson details" onClick={() => setMoreOpen(false)}><TransportIcon name="close" /></button></div>
                <p>No provider calls happen during playback. Practice keeps the backing audible and mutes only the cached guitar stem.</p>
                <dl><div><dt>Analysis</dt><dd>Klangio cache</dd></div><div><dt>Lesson QA</dt><dd>Passed · 0 unresolved</dd></div><div><dt>QA scope</dt><dd>Chords + rhythm</dd></div><div><dt>Beat grid</dt><dd>{song.beats.length} beats · {song.analysis.beatReport?.repairs.length ?? 0} repaired</dd></div><div><dt>Lyrics</dt><dd>Automatic ASR</dd></div><div><dt>Chord coverage</dt><dd>{coverage}%</dd></div><div><dt>Practice audio</dt><dd>Cached stems</dd></div></dl>
                <label className="details-loop">Loop section<select aria-label="Loop section" value={selectedPhraseId} onChange={(event) => { setSelectedPhraseId(event.target.value); setLoopEnabled(true); }}>{song.phrases.map((phrase) => <option value={phrase.id} key={phrase.id}>{phrase.label} · {formatTime(phrase.startSec)}–{formatTime(phrase.endSec)}</option>)}</select></label>
                <button type="button" className="details-action" onClick={selectCurrentPhrase}>Use current phrase</button>
                <label className="details-sync">A/V sync<span><input aria-label="Audio visual sync adjustment" aria-valuetext={syncOffsetLabel} type="range" min="-180" max="180" step="10" value={syncAdjustmentMs} onInput={(event) => setSyncAdjustmentMs(Number(event.currentTarget.value))} /><b>{syncOffsetLabel}</b></span><small>Fine-tune only when your audio device makes the visuals appear early or late.</small></label>
                <small>{song.analysis.chordReport.warning}</small>
                {song.analysis.chordReport.corrections?.map((correction) => <small key={`${correction.timeSec}-${correction.chord}`}><strong>Reviewed override:</strong> {correction.chord} at {formatTime(correction.timeSec, true)} after an audible provider miss.</small>)}
                {song.analysis.beatReport?.repairs.map((repair) => <small key={`${repair.timeSec}-${repair.beat}`}><strong>Beat-grid repair:</strong> beat {repair.beat} at {formatTime(repair.timeSec, true)} filled a provider-window gap.</small>)}
              </aside>
            ) : null}
          </div>
        </div>
      </header>

      {loadError ? <div className="inline-warning" role="alert"><span>{loadError}</span><button type="button" onClick={() => { setLoadError(""); backingRef.current?.load(); guitarRef.current?.load(); }}>Retry audio</button></div> : null}
      {countInBeat !== null ? <div className="count-in-overlay" role="status" aria-live="assertive"><span>COUNT IN · {song.tempo.beatsPerBar ?? 4}/{song.tempo.beatUnit ?? 4} · {Math.round(song.tempo.bpm * speed)} BPM</span><strong>{countInBeat}</strong><small>Come in after {song.tempo.beatsPerBar ?? 4}</small></div> : null}

      <section className="now-lane" aria-label="Current practice instruction" tabIndex={0}>
        <div className="lyric-lane-label"><span className="section-kicker"><i />{lessonComplete ? "COMPLETE" : playing ? "LYRICS · NOW" : "LYRICS · READY"}</span><small>{metronomeEnabled ? `${song.tempo.beatsPerBar ?? 4}-count + audible ticks at ${Math.round(song.tempo.bpm * speed)} BPM` : "Metronome off"}</small></div>
        <div className="lyric-stack"><LyricLine segment={activeSegment} time={displayTime} active chordEvents={song.chordEvents} /><LyricLine segment={nextSegment} time={displayTime} active={false} chordEvents={song.chordEvents} /></div>
        <SongChordLibrary chords={songChordNames} voicings={song.voicings} currentChord={instructionChord?.chord} capoFret={song.metadata.capoFret ?? 0} />
      </section>

      <Fretboard current={instructionChord} next={visualNextChord} voicings={song.voicings} preparing={preparing} currentCue={handCue} secondsToNext={secondsToNext} complete={lessonComplete} capoFret={song.metadata.capoFret ?? 0} />

      <section className="practice-dock">
        <section className="coach-panel" aria-label="Strum Coach" tabIndex={0}>
          <header><div><span className="section-kicker">STRUM COACH</span><strong>{rhythmAvailable ? "D · MISS · D U · MISS · U D U" : "Rhythm unavailable"}</strong><small>Keep your hand moving. MISS means pass the strings without touching them.</small></div><div className="stroke-status"><span>NOW <b>{rhythmAvailable ? handCue.label : "Unknown"}</b></span><span>NEXT <b>{nextHandCue?.label ?? "—"}</b></span></div></header>
          <div className={`strum-grid ${playing ? "is-playing" : "is-paused"}`} style={strumStyle} aria-label="Eight-slot strum pattern: down, move up without contact, down, up, move down without contact, up, down, up">
            <i className="strum-playhead" aria-hidden="true" />
            {STRUM_BAR_PATTERN.map((step, index) => {
              const cue = rhythmAvailable && step.direction ? displayStrum(step.direction) : null;
              const motion = cue ?? displayHandMotion(step.motion);
              return <span className={`strum-slot ${index === strumBar.activeIndex ? "is-current" : ""} ${cue ? "is-stroke" : "is-rest"}`} aria-current={index === strumBar.activeIndex ? "step" : undefined} title={cue ? `${cue.label} strum` : motion.label} key={`${step.beat}-${index}`}><small>{step.beat}</small><b>{motion.arrow}</b><em>{cue?.short ?? "MISS"}</em></span>;
            })}
          </div>
        </section>

        <section className="transport-panel" aria-label="Playback controls">
          <div className="progress-row">
            <span>{formatTime(seekPreviewTime ?? time)}</span>
            <div className={`timeline-track ${loopEnabled ? "has-loop" : ""}`} style={timelineStyle}>
              {loopEnabled ? <i className="loop-range" aria-hidden="true" /> : null}
              <input aria-label="Song position" aria-valuetext={`${formatTime(seekPreviewTime ?? time)} of ${formatTime(song.audio.durationSec)}`} title="Drag to seek through the song" type="range" min="0" max={song.audio.durationSec} step="0.01" value={seekPreviewTime ?? time} onPointerDown={beginSeek} onPointerUp={commitSeek} onKeyDown={beginSeek} onKeyUp={commitSeek} onBlur={commitSeek} onInput={(event) => previewSeek(Number(event.currentTarget.value))} />
              {seekPreviewTime !== null ? <output className="seek-tooltip">{formatTime(seekPreviewTime, true)} · {instructionChord?.chord ?? "—"}<small>{seekSegmentText}</small></output> : null}
            </div>
            <span>{formatTime(song.audio.durationSec)}</span>
          </div>
          <div className={`phrase-summary ${loopEnabled ? "is-looping" : ""}`} aria-live="polite">
            {loopEnabled ? <TransportIcon name="loop" /> : <i aria-hidden="true" />}
            <span>{loopEnabled ? "LOOPING" : "CURRENT PHRASE"}</span>
            <strong>{activePhrase?.label ?? "Full lesson"}</strong>
            <b>{activePhrase ? `${formatTime(activePhrase.startSec)}–${formatTime(activePhrase.endSec)}` : `0:00–${formatTime(song.audio.durationSec)}`}</b>
          </div>
          <div className="phrase-map" aria-label={`Lesson phrase map; ${activePhrase?.label ?? "full lesson"} current`}>
            {song.phrases.map((phrase, index) => <span className={phrase.id === activePhrase?.id ? "is-current" : ""} key={phrase.id}><i />{index + 1}</span>)}
          </div>
          <div className="transport-row">
            <button type="button" className="transport-action" aria-label="Previous chord" title="Previous chord" onClick={() => jumpChord(-1)}><TransportIcon name="previous" /><small>Previous</small></button>
            <button type="button" className="transport-action" aria-label={loopEnabled ? "Restart loop section" : "Restart song"} title="Restart" onClick={restartPlayback}><TransportIcon name="restart" /><small>Restart</small></button>
            <button type="button" aria-label={countInBeat !== null ? "Cancel count-in" : playing ? "Pause" : "Play"} title={countInBeat !== null ? "Cancel count-in" : playing ? "Pause (Space)" : "Play (Space)"} className="play-button" onClick={togglePlayback}><TransportIcon name={playing || countInBeat !== null ? "pause" : "play"} /><small>{countInBeat !== null ? "Count-in" : playing ? "Pause" : "Play"}</small></button>
            <button type="button" className="transport-action" aria-label="Next chord" title="Next chord" onClick={() => jumpChord(1)}><TransportIcon name="next" /><small>Next</small></button>
            <button type="button" className={`transport-action loop-transport ${loopEnabled ? "is-active" : ""}`} aria-label="Loop phrase" aria-pressed={loopEnabled} title="Loop current phrase (L)" onClick={toggleLoopAtCurrentTime}><TransportIcon name="loop" /><small>{loopEnabled ? "Looping" : "Loop"}</small></button>
            <div className="mode-group" aria-label="Backing mode"><span>{mixMode === "practice" ? "Practice · Guitar off" : "Original · Guitar on"}</span><div className="mix-mode"><button type="button" aria-pressed={mixMode === "original"} className={mixMode === "original" ? "active" : ""} onClick={() => setMixMode("original")}>Original</button><button type="button" aria-pressed={mixMode === "practice"} className={mixMode === "practice" ? "active" : ""} onClick={() => setMixMode("practice")}>Practice</button></div></div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
