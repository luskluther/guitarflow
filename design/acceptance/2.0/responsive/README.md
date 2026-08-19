# Responsive acceptance matrix

Measured in the live Vite application on 2026-08-18. The acceptance harness gives the iframe the exact CSS viewport shown below; scaling happens only outside the iframe for capture.

| Mode | Viewport | Scroll width × height | Intent | Minimum target | Result |
|---|---:|---:|---|---:|---|
| Wide desktop | 1920 × 1080 | 1920 × 1080 | One-screen, centered max-width stage | 44 × 44 | PASS |
| Compact desktop | 1024 × 768 | 1024 × 768 | One-screen compact desktop | 44 × 44 | PASS |
| Tablet | 834 × 1194 | 834 × 1194 | One-screen stacked dock | 44 × 44 | PASS |
| Mobile | 390 × 844 | 375 × 1254 | Intentional vertical flow; no horizontal overflow | 44 × 44 | PASS |

Every mode retained the lyric, merged NOW/HAND/NEXT guidance, finger pose, directional MISS pattern, play, speed, metronome, loop access, and mode controls. Mobile owns vertical scrolling; the transport remains in document flow and never overlays the lyric. The redundant header Loop hides only on mobile because the identical transport Loop remains reachable.

Evidence: `1920x1080-rest.jpg`, `1024x768-rest.jpg`, `834x1194-rest.jpg`, and `390x844-rest.jpg`.

All four captures were refreshed after merged guidance, count-in/metronome, QA-checked metadata, and 100%/Original defaults were introduced. Compact desktop retains every transport control without overlap; tablet and mobile keep the same explicit practice meaning in their vertical flow.
