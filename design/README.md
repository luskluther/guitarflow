# GuitarFlow design references

This directory contains visual references for the GuitarFlow Chord Mode experience.

## Reference image

[Chord Mode reference](reference/guitarflow-chord-mode-reference.png)

The reference shows the intended visual direction for a practice screen: a bright, quiet layout; synchronized lyrics and chord changes; past, now, and next chord context; an angled player-view fretboard with hand guidance; and playback, speed, loop, and guitar-mix controls.

This image is a design reference, not a replacement for the product requirements in `docs/PRD.md`, `docs/UI_SPEC.md`, or `docs/FEASIBILITY_SPIKE.md`.

## Runtime visual assets

The MVP hero uses project-local generated assets derived from the reference's visual direction:

- [`../frontend/public/assets/fretboard-player-view-v1.png`](../frontend/public/assets/fretboard-player-view-v1.png) — clean player-view guitar neck without baked UI or markers.
- [`../frontend/public/assets/hand-guidance-v1.png`](../frontend/public/assets/hand-guidance-v1.png) — transparent fretting-hand guidance layer.

All synchronized labels and finger markers remain code-driven. The fretboard orientation is high `e` at the top and low `E` at the bottom.

## Visual acceptance

The current 2.0 responsive, geometry, state, synchronization, accessibility, and final engineering evidence is indexed in [`acceptance/2.0/README.md`](acceptance/2.0/README.md). Exact 1920 × 1080, 1024 × 768, 834 × 1194, 390 × 844, and 200%-zoom harnesses render the real application inside fixed CSS viewports.
