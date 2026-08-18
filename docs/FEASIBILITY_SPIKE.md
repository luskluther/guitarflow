# GuitarFlow Technical Feasibility Spike v1

## Goal
Prove one real song can drive the approved Chord Mode UI convincingly enough to practice with.

Do not build the full product. The spike succeeds when one verse/chorus or short test section remains synchronized across audio, lyrics, chord timing, strums, fretboard/hand guidance, slowdown, looping, and adjustable guitar mix.

## Input strategy
Start with one technically simple song or 10–15 second clip:
- clear vocal
- clear rhythm guitar
- 4/4 preferred
- common chords/open shapes preferred
- at least 2–4 chord changes
- avoid dense production for the first test

Do not start with a difficult arrangement simply because it appeared in the mockups.

## External analysis provider
First provider: Klangio API.
Keep all provider-specific logic behind an adapter.

Initial experiments:
1. beat tracking
2. chord recognition
3. strum recognition
4. source separation
5. guitar transcription / available symbolic outputs

Inspect what is actually returned before committing architecture.

## Immutable cache requirement
Klangio calls are scarce.

### Cache key
At minimum:
- SHA-256 of source audio bytes
- endpoint/method
- normalized request parameters
- provider/API/model version when exposed

### Cache layout
Example:

```text
data/cache/klangio/<audio-sha256>/
  manifest.json
  source/
    source.ext
  beat-tracking/<request-hash>/
    request.json
    job.json
    raw-response.json
    outputs/...
  chord-recognition/<request-hash>/
    request.json
    job.json
    raw-response.json
    outputs/...
  strum-recognition/<request-hash>/
    request.json
    job.json
    raw-response.json
    outputs/...
  transcription/<request-hash>/
    request.json
    job.json
    raw-response.json
    output.mid
    output.musicxml
    outputs/...
  source-separation/<request-hash>/
    request.json
    job.json
    raw-response.json
    stems/...
```

### Rules
- Cache before parsing into application structures.
- Never overwrite original raw responses.
- Re-running parsers/tests/UI must not hit Klangio.
- Network disabled by default.
- Add an explicit `--allow-network` or environment switch for new calls.
- Log cache hit/miss clearly.
- Save failed responses too if they contain useful diagnostic data.

## Proposed spike architecture
### Frontend
- React + TypeScript + Vite.
- Start with SVG/Canvas/DOM for fretboard and finger markers.
- Move to Three.js/rigged 3D only if needed for the transparent-hand requirement.

### Backend
- Python + FastAPI.
- Responsibilities:
  - ingest local audio
  - invoke Klangio adapter
  - persist immutable provider cache
  - normalize analysis
  - expose local project/timeline JSON

### Storage
Local filesystem only. No database required for the spike.

## Canonical GuitarFlow model
The frontend must never depend directly on Klangio response structures.

Conceptual model:

```text
Song
  metadata
  audio
  tempo
  key
  timeSignature
  beats[]
  bars[]
  sections[]
  lyrics[]
  chordEvents[]
  strumEvents[]
  tracks[]
  voicings[]
  handPoses[]
  timelineEvents[]
```

Each event should use the same master timeline in seconds plus musical position where available.

Example runtime state:

```json
{
  "timeSec": 42.375,
  "section": "verse_1",
  "lyric": {
    "lineId": "line_4",
    "word": "highway",
    "characterIndex": 4
  },
  "chord": {
    "current": "G",
    "next": "D",
    "nextChangeSec": 43.795
  },
  "strum": {
    "current": "down",
    "next": "down"
  },
  "hand": {
    "previousPoseId": "C_OPEN_01",
    "currentPoseId": "G_OPEN_01",
    "nextPoseId": "D_OPEN_01"
  },
  "speed": 0.75,
  "guitarLevel": 0.25
}
```

## Synchronization model
Use one master playback clock.

Three conceptual timelines must derive from it:
1. Audio timeline — playback time.
2. Musical timeline — beats, bars, chord events, strums.
3. Instruction timeline — lyric position, hand state, next-pose preview, active strum.

Do not allow independent timers per widget.

## Mini-spikes
### Spike A — Klangio reality check
Run the selected clip through the required Klangio endpoints exactly once each, caching all results.
Answer:
- What timing granularity is provided?
- Are chord timestamps useful?
- Does strum recognition expose direction/timestamps reliably?
- What source-separation stems are available?
- What guitar symbolic outputs are available?

### Spike B — normalization
Convert cached results into GuitarFlow’s canonical JSON.
Add tests that replay normalization from cache only.

### Spike C — ugly synchronized player
Before the polished UI, prove:
- audio playback
- lyric line timing
- chord timing
- active strum
- fret/string markers
- previous/current/next positions
- 100/75/50% speed
- loop
- adjustable guitar level

Plain circles/markers are acceptable here.

### Spike D — approved visual treatment
After timing works, replace markers with the approved angled player-view fretboard and transparent hand treatment.

## Lyrics alignment research
Klangio may not provide sufficient character/syllable-level lyric timing. If not, evaluate a separate alignment stage.

Preferred fallback order:
1. phoneme/character
2. syllable
3. word
4. beat-relative chord indicator

The MVP can initially use word/syllable timing if character-level alignment is not reliable enough, but the data model should permit more precise alignment later.

## Hand-pose strategy
For the spike, do not solve arbitrary guitar biomechanics.
Start with a small deterministic chord-pose set, for example:
- G
- C
- D
- Em
- Am
- E
- A
- Dm

Map each pose to:
- string
- fret
- finger number
- optional thumb placement

MVP requires plausible previous/current/next positions, not perfect transition physics.

## Acceptance criteria
The spike passes if one real test section at 100%, 75%, and 50% speed has:
- stable audio playback
- no accumulating timing drift
- chord cue at a musically convincing lyric point
- strum highlight aligned to the groove
- correct fret/string orientation
- correct finger numbering/placement for the chosen voicing
- previous/current/next visual states
- next-hand preview early enough to prepare
- loop that restarts cleanly
- adjustable original-guitar percentage
- UI state driven entirely from one master clock

## Failure criteria / stop conditions
Stop and investigate before expanding scope if:
- chord/strum timing is consistently too inaccurate to practice with
- slowdown introduces visible/audio desynchronization
- loop restart drifts
- source separation cannot provide a useful guitar practice mix
- provider output is too inconsistent to normalize reliably

## Explicitly not part of this spike
- Lead/Solo
- Fingerstyle generation
- Jam mode
- personalized difficulty model
- microphone listening/scoring
- accounts/cloud persistence
- mobile/tablet clients
- public song libraries/community sharing

## Deliverable
A local repo that can:
1. analyze one new test clip with explicitly enabled network access,
2. cache all Klangio outputs immutably,
3. subsequently run entirely offline from cache,
4. build a canonical `song.json`, and
5. drive a synchronized Chord Mode proof screen.
