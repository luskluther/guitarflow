# Synchronization and interaction evidence

## 2026-08-19 perceived-lag correction

The player previously initialized output compensation to a hard 140ms floor and then used `max(current, measured)`, so a real browser measurement could never reduce it. This made every visual consumer intentionally trail the media clock by at least 70–140ms depending on speed. The default is now zero, the first playback adopts the bounded browser measurement directly (10ms in the acceptance browser), and the advanced sync control supports both visual lead and delay.

The raw Klangio chord responses and canonical model were also audited for missing C events. All five provider C intervals are preserved, including the short `9.09–9.72` and `24.16–24.78` events. Live playback inside both short events showed C simultaneously in NOW, the lyric anchor when vocals exist, the player-view pose, and the active all-song reference shape. A model test now requires every vocal-section chord boundary—and specifically C at 19.11, 24.16, and 29.18—to have an exact visible lyric anchor.

The product-owner audit then identified an additional audible change at “fork/stuck” that Klangio had smoothed into the surrounding G interval. Guitar-stem chroma changes toward C around cached beat 3, so the derived lesson now explicitly splits `G 11.58–14.11`, `C 14.11–15.35`, and `D 15.35–16.61`. The immutable provider response remains unchanged, `analysis.chordReport.corrections` discloses the override, and live playback verified the lyric anchor inside “fork,” NOW chord, player pose, active reference shape, and NEXT chord atomically.

## Atomic chord-transition matrix

The live browser started 700ms before representative boundaries for every target voicing at every speed. `before` required current chord/diagram to agree, preparation to be visible, and the next pose to exist. `at` required current chord, current diagram, and current pose label to switch together. Polling interval was 10ms; no mixed widget state was observed.

| Speed | Target | Boundary | Before | At/after | Result |
|---:|---|---:|---|---|---|
| 50% | C | 4.09 | G + Prepare C + 3 rings | C / C Major / C pose | PASS |
| 50% | D | 5.34 | C + Prepare D + 3 rings | D / D Major / D pose | PASS |
| 50% | G | 6.60 | D + Prepare G + 3 rings | G / G Major / G pose | PASS |
| 50% | Em | 21.63 | D + Prepare Em + 2 rings | Em / E Minor / Em pose | PASS |
| 75% | C | 4.09 | G + Prepare C + 3 rings | C / C Major / C pose | PASS |
| 75% | D | 5.34 | C + Prepare D + 3 rings | D / D Major / D pose | PASS |
| 75% | G | 6.60 | D + Prepare G + 3 rings | G / G Major / G pose | PASS |
| 75% | Em | 21.63 | D + Prepare Em + 2 rings | Em / E Minor / Em pose | PASS |
| 100% | C | 4.09 | G + Prepare C + 3 rings | C / C Major / C pose | PASS |
| 100% | D | 5.34 | C + Prepare D + 3 rings | D / D Major / D pose | PASS |
| 100% | G | 6.60 | D + Prepare G + 3 rings | G / G Major / G pose | PASS |
| 100% | Em | 21.63 | D + Prepare Em + 2 rings | Em / E Minor / Em pose | PASS |
| 50% | C override | 14.11 | G + Prepare C + 3 rings | C / C Major / C pose + lyric anchor | PASS |
| 75% | C override | 14.11 | G + Prepare C + 3 rings | C / C Major / C pose + lyric anchor | PASS |
| 100% | C override | 14.11 | G + Prepare C + 3 rings | C / C Major / C pose + lyric anchor | PASS |

The 29 frontend tests additionally check every one of the 19 chord boundaries at 50%, 75%, and 100% (57 atomic boundary cases), the 800ms preparation window, short-chord available lead, preview freezing, loop clamping, count-in contracts, continuous MISS motions, quality blocking, and capo projection.

## Count-in, metronome, and beat grid

- The main lesson derives 4/4 and 96 BPM from cached beat tracking. With Metronome On, Play presents and sounds one speed-adjusted `1–2–3–4` bar before both media tracks begin at the first restored downbeat, 0.31s.
- Each beat now uses a bright square-wave transient plus a slightly longer triangle-wave body so the tick remains audible over the song; beat 1 is higher and stronger. Switching Metronome from Off to On plays an immediate preview tick.
- The 3/4 fixture presents and sounds `1–2–3` at 90 BPM. Metronome Off bypasses count-in; cancelling leaves song time at zero; Restart while playing schedules a fresh count-in.
- Ongoing clicks use the same 48-event beat grid as the presentation clock, accent beat 1, and scale wall-clock spacing with playback speed.
- The provider supplied 45 beats. The model discloses three derived repairs at 0.31s, 14.73s, and 29.81s. Only provider beats may snap chord boundaries, so metronome continuity cannot manufacture or move a harmonic event.

## Seek

- Paused seek to 15.36s immediately previewed `0:15.4 · D` and the matching lyric, diagram, and fretboard while the audio master remained at 12.00s.
- Blur/Tab committed both tracks to 15.36s, removed the tooltip, and remained paused.
- Keyboard seek during playback resumed in `Pause` (playing) state, with backing and guitar continuing from the new location.
- All preview consumers derive synchronously from one `getPresentationState` result.

## Loop and audio drift

Four phrases × three speeds were started 30ms before each loop end. Every case wrapped to the selected phrase, retained the exact visible range, and showed no stale pre-loop presentation state. Backing/guitar drift ranged from 0ms to 42.85ms, below the 45ms gate. Loop assignment happens in the same animation-frame tick; the next render is bounded to one frame, below the 40ms gate on the 60Hz acceptance browser.

## Mode and speed continuity

During live playback, 75% → 50%, Original, then Practice advanced master time `12.218 → 12.442 → 12.642` without a restart. Original reported gain `1` and `Original · Guitar on`; Practice reported gain `0` and `Practice · Guitar off`.
