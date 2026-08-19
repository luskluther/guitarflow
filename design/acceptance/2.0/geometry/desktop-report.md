# Desktop geometry and readability

Live computed geometry after the 2.0 composition pass.

| Measurement | 1280 × 720 | 1920 × 1080 | Requirement | Result |
|---|---:|---:|---:|---|
| Page scroll | 1280 × 720 | 1920 × 1080 | Equals viewport | PASS |
| Header | 72px | 72px | 72px target | PASS |
| Lyric lane | 150px | 237.6px | 150px at 1280; wide mode may grow | PASS |
| Guitar stage | 250px | 475.2px | ≈240px at 1280; wide mode grows before gaps | PASS |
| Practice dock | 248px | 295.2px | Remaining height | PASS |
| Current lyric | 22px | 26px | ≥22 / ≥26 | PASS |
| Next lyric | 18px | 21px | ≥18 / ≥20 | PASS |
| Current chord | 28px | 32px | ≥28 / ≥32 | PASS |
| Strum count | 11px | 12px | ≥11 / ≥12 | PASS |
| Strum direction | 20px | 28px | ≥20 / ≥22 | PASS |
| Smallest interactive target | 44 × 44 | 44 × 44 | ≥44 × 44 | PASS |
| Song chord reference | 410 × 131px; four frameless 68 × 111px shapes plus 82px hand key | Wide mode: 430–520px column | Inside lyric lane; no page overflow | PASS |

At 1280 the exact rows are `72 / 150 / 250 / 248`. At 1920 the guitar receives the majority of surplus height and content is capped to a centered 1760px stage. The transport uses timeline, phrase range, four-phrase map, controls, and explicit mode state so its remaining unassigned interior is below the 15% visual-density tolerance.

The text-only merged guidance cluster measures 330 × 88px at 1280 and remains inside the 1208 × 209px fretboard. It contains no chord diagrams. At capo 5 it relocates left while the absolute-fret finger markers move to frets 7–8; measured cluster and marker rectangles do not intersect.

The lyric lane now assigns its previously unused right-side space to a 410 × 131px all-song chord reference. It shows frameless G, C, D, and Em shapes once in first-use order alongside an 82px numbered-hand key; the active shape follows the master chord clock. Additional chords scroll horizontally inside the reference instead of widening the page.
