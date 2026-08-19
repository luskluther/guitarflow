# Accessibility acceptance

## Contrast

| Pair | Ratio | Result |
|---|---:|---|
| Ink / surface | 16.22:1 | PASS |
| Secondary / surface | 6.15:1 | PASS |
| Quiet / surface | 4.99:1 | PASS |
| Current text / current surface | 5.46:1 | PASS |
| Uncertain / surface | 4.89:1 | PASS |
| White / ink | 16.59:1 | PASS |

Current, next, loop, Practice, focus, and uncertainty do not rely on color alone: they also use explicit text, border/shape, `aria-current`/`aria-pressed`, or dotted underline plus tooltip.

## Keyboard and semantics

DOM focus order is header speed → header loop → header metronome → overflow → Current practice instruction → Strum Coach → timeline → Previous → Restart → Play → Next → transport Loop → Original → Practice. Metronome exposes `aria-pressed`; the count-in uses an assertive status and the Play button becomes `Cancel count-in`. Icon-only controls have accessible names and native `title` tooltips. Global Arrow, L, plus/minus, and Space handling ignores buttons, selects, and inputs. The visible section focus ring is a 3px orange-tinted outline with 2px offset; see `1280-focus-now.jpg`.

## Zoom and responsive ergonomics

The 200% equivalent viewport is 640 × 360 CSS pixels. It measured 625px content width inside a 640px viewport, 22px current lyrics, and a 44px minimum target. The whole lesson is reachable through vertical flow with no horizontal clipping. See `200-percent-zoom-top.jpg` and `200-percent-zoom-controls.jpg`.

`prefers-reduced-motion: reduce` removes animation/transition duration and explicitly disables interpolation on the strum playhead and lyric caret. Musical state still snaps from the same presentation timestamp.
