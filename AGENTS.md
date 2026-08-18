# AGENTS.md — GuitarFlow

## Read first
Before making changes, read:
- `docs/PRD.md`
- `docs/UI_SPEC.md`
- `docs/FEASIBILITY_SPIKE.md`

## Current phase
**Technical feasibility only.** Do not build the full product yet.

Primary goal: prove that one real song can drive the approved Chord Mode UI with synchronized audio, lyrics, chord changes, strums, fretboard positions, finger placements, and previous/current/next hand states.

## Critical Klangio cache rule
Klangio free-tier/API requests are scarce. Treat every successful request as durable test data.

Before every Klangio call:
1. Compute a cache key from source-audio content hash + endpoint + relevant parameters + exposed model/API version.
2. If an equivalent cached result exists, use it. Do not call the network.
3. If no cache exists and network access is explicitly enabled, call Klangio once.
4. Save all request metadata, job metadata, raw responses, downloaded outputs, stems, MIDI, MusicXML, JSON, errors/warnings, and exposed version metadata.
5. Never overwrite original raw API responses.
6. Parser/UI/test changes must re-use cached artifacts rather than re-calling Klangio.

Development default must be network-off, e.g. `KLANGIO_NETWORK_ENABLED=false`. A new Klangio request requires deliberate opt-in.

## Secrets
- Never commit `.env`, API keys, tokens, or credentials.
- Provide `.env.example` only.

## Scope guardrails
Do not implement during the feasibility phase:
- Lead/Solo mode
- Fingerstyle mode
- Jam mode
- mobile/tablet app
- authentication
- subscriptions
- social/community/library features
- production cloud infrastructure
- microphone performance scoring
- sophisticated biomechanical hand-transition coaching

## Product invariants
- Single-screen practice experience.
- White/bright premium visual language with orange reserved for “do this now.”
- Fretboard is the visual anchor.
- Player-view angled neck.
- Low E/thick string at bottom, high E/thin string at top.
- Transparent hand guidance.
- Standard finger numbering: 1=index, 2=middle, 3=ring, 4=pinky.
- Show previous/current/next hand states.
- Two synchronized lyric lines.
- Chord change should align to the exact lyric word/syllable/letter when timing data allows.
- Current strum is highlighted in orange.
- Practice mix allows adjustable original-guitar percentage.
- Playback speed and looping must preserve synchronization.

## Implementation behavior
- Prefer small, testable vertical slices.
- Do not optimize prematurely.
- Keep provider-specific data behind an adapter and normalize into GuitarFlow’s own song model.
- The UI must consume a single master timeline/state model rather than directly consuming vendor responses.
- Stop and surface uncertainty instead of inventing musical data.
