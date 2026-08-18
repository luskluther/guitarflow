# GuitarFlow

GuitarFlow is a local-first visual guitar learning prototype that turns a user-supplied song into a synchronized play-along lesson.

## Current status
**Technical feasibility phase.** The repo intentionally does not yet contain the full application.

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

## API safety
Klangio free-tier requests are limited. All provider responses must be cached immutably and reused. Network access should be disabled by default during development.
