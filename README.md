# GuitarFlow

GuitarFlow is a local-first visual guitar learning prototype that turns a user-supplied song into a synchronized play-along lesson.

## Current status
**One-song Chord Mode feasibility MVP is ready for local testing.** It uses a cached 30-second section to prove the synchronized practice experience. This is not yet the arbitrary-song production application.

The personal-use sellability contract in [`ENGINEERING_GRAPH_2.0.md`](ENGINEERING_GRAPH_2.0.md) is complete at 70/70, with reproducible engineering evidence under [`design/acceptance/2.0/`](design/acceptance/2.0/) and explicit owner acceptance for the human-dependent nodes. The earlier 100-point technical contract remains archived in [`ENGINEERING_GRAPH.md`](ENGINEERING_GRAPH.md).

Optional independent beginner validation can be run locally at [`/usability-test.html`](http://localhost:5173/usability-test.html). It records anonymous timed comprehension and unassisted task outcomes in Simple English or Hindi, then exports independently verifiable evidence. No external participant study is claimed for the personal-use score.

Read in this order:
1. `AGENTS.md`
2. `docs/PRD.md`
3. `docs/UI_SPEC.md`
4. `docs/FEASIBILITY_SPIKE.md`

## Immediate milestone
Take one real test song/clip and prove Chord Mode synchronization across:
- audio
- lyrics
- chord changes
- strum timing
- fretboard/finger placement
- previous/current/next hand guidance
- slowdown
- looping
- adjustable original-guitar level

## Design references
Visual references for the Chord Mode experience are maintained in [`design/`](design/), with the attached reference image in [`design/reference/`](design/reference/). See [`design/README.md`](design/README.md) for context and visual notes.

## Spike A
The cache-first Spike A runner is [`backend/spike_a.py`](backend/spike_a.py). It accepts one 10–15 second WAV clip and performs one bounded Klangio pass covering beat tracking, extended chord/strum/key recognition, six-stem separation, and MIDI transcription. Every request, status response, result, and downloaded artifact is retained under `data/cache/klangio/<source-sha256>/`.

After placing a clip at `data/source/spike-a.wav`, install `backend/requirements-spike-a.txt` if needed and run:

```powershell
python backend/spike_a.py --audio data/source/spike-a.wav --allow-network
```

The explicit `--allow-network` flag and `KLANGIO_NETWORK_ENABLED=true` are both required. Verify an existing cache without network access with:

```powershell
python backend/spike_a.py --audio data/source/spike-a.wav --verify-only
```

## Automatic lyrics
Lyric discovery is a separate cache-first step. It runs local automatic speech recognition on the cached vocal stem and saves raw word timings, normalized lyric segments, and an alignment report under `data/cache/lyrics/<audio-sha256>/`. Install `backend/requirements-lyrics.txt` before running the lyric pass.

The cached lyric words can be joined to the cached chord timeline for a UI review with `backend/lyrics_timeline.py`; this produces `timeline-preview.json` containing previous/current/next chord context for each word.

## Local MVP
The current Chord Mode proof screen is in [`frontend/`](frontend/). The fixture model and audio are already staged in `frontend/public/`. Run it locally with:

```powershell
cd frontend
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal. The screen uses one audio clock for lyric highlighting, chord context, fretboard guidance, strum highlighting, speed, loop, seek, and guitar-level controls.

The testable MVP includes:
- synchronized cached lyrics, chords, strums, and fretboard poses
- text-only current/next chord guidance, all-song fingering diagrams, and live hand states
- deterministic beginner G, C, D, and Em open-chord fingering
- a compact, scrollable **Chords in song** reference beside the lyrics, with every unique chord shown once in first-use order and the live chord highlighted
- 100%, 75%, and 50% playback
- selectable lyric-phrase looping and chord navigation
- a real practice mix made from separate backing and guitar stems
- Original and Practice modes with adjustable guitar percentage
- an explicit cached-analysis quality label
- one-bar 3/4 or 4/4 count-in and a clearly audible on/off metronome locked to the speed-adjusted BPM; enabling it plays a preview tick
- a publication quality gate that blocks unresolved timeline gaps and suspicious beat-level guitar changes

Klangio simplified this fixture to major/minor chord identities. The UI therefore presents the output as beginner voicings rather than claiming exact studio-performance chord extensions. Raw provider artifacts remain immutable; the derived lesson discloses a reviewed C override at 14.11s where the provider smoothed over the audible “fork/stuck” change.

Provider output is never published blindly. `backend/song_quality.py` checks timeline continuity, tempo/time signature, beat coverage, capo projection, and beat-synchronous guitar chroma. Suspicious acoustic changes without a nearby chord boundary block publication until a reviewed correction resolves them. This reduces silent provider misses but does not claim that automatic transcription can be mathematically perfect for every recording. The current product is Chord Mode, so it validates chords and rhythm rather than claiming note-perfect tablature; a future note-level mode is blocked unless an independent note report passes.

Install [`backend/requirements-song.txt`](backend/requirements-song.txt) before building a lesson. The builder requires the cached isolated guitar WAV and exits without writing a publishable lesson when the quality gate has unresolved findings:

```powershell
python backend/build_song.py `
  --audio frontend/public/fixtures/spike-a-ui-30s.wav `
  --guitar-audio frontend/public/fixtures/guitar.wav `
  --lyrics data/cache/lyrics/<audio-hash>/<request-hash>/normalized-lyrics.json `
  --corrections data/reviewed-chord-corrections.json `
  --window "0;data/cache/klangio/<first-window-hash>" `
  --window "15;data/cache/klangio/<second-window-hash>" `
  --output data/song.json
```

## Rebuild the practice mix offline
The browser uses two synchronized 30-second files: a backing mix and an isolated guitar track. Rebuild them entirely from the immutable cached Klangio stems with:

```powershell
python backend/build_practice_audio.py `
  --window "0;data/cache/klangio/5a59b108414681f7519bae4d66e659744b6ae11a06d0c7e960bf407869c9acb0" `
  --window "15;data/cache/klangio/b5e15367dbf10cf23d919f6dddfe50f2d5dc1b902d8ad7ebaa213aac9515ebca" `
  --backing-output frontend/public/fixtures/backing.wav `
  --guitar-output frontend/public/fixtures/guitar.wav `
  --report-output data/practice-audio-report.json
```

Install [`backend/requirements-practice-audio.txt`](backend/requirements-practice-audio.txt) if NumPy is not already available. No provider network call is made.

## MVP test checklist
1. Open the local player and use **Next chord** to enter the analyzed section.
2. Play at 100%, 75%, and 50%; lyric, chord, strum, and hand state should advance from one clock.
3. Select a phrase and enable Loop; playback should return to the phrase start without stopping.
4. Switch between Original and Practice, then move Guitar Level between 0% and 100%.
5. Confirm the lyric chord anchor, merged NOW/HAND/NEXT cluster, fretboard pose, and Strum Coach change together.

Run the automated frontend invariants with:

```powershell
npm --prefix frontend test
```

## API safety
Klangio free-tier requests are limited. All provider responses must be cached immutably and reused. Network access should be disabled by default during development.
