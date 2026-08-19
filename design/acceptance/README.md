# Visual acceptance evidence

## Reference viewport

The supplied design reference is 1920 × 1920 px. The local acceptance harness at
`/acceptance/reference-1920.html` renders the real app in a fixed 1920 × 1920
same-origin iframe and scales only the outer preview. This preserves the real
desktop media query, font sizing, and component geometry even when the Codex
browser panel is narrower.

The harness is layout-only and starts at 0:00. Active timeline states are
verified separately through browser-driven seeks in the real app.

## Measurable visual tolerance

Visual nodes V2 and V5 pass when:

- major section anchors are within 24 px of the reference at 1920 px;
- major section dimensions are within 5% of the reference;
- the 3.7% left/right page inset is preserved;
- the hero remains the largest visual anchor;
- there is no horizontal overflow at either 1920 px or the 1180 px minimum;
- the same white, charcoal, gray, and orange hierarchy is preserved;
- no primary reference control or information region is omitted.

## Geometry comparison

| Region | Reference | Implementation | Result |
|---|---:|---:|---|
| Header height | 175 px | 174 px | Pass, −1 px |
| Header title x | 180 px | 179 px | Pass, −1 px |
| Context panel x | 1278 px | 1279 px | Pass, +1 px |
| Context cards y | 260 px | 260 px | Pass |
| Fretboard x | 72 px | 71 px | Pass, −1 px |
| Fretboard y | 680 px | 680 px | Pass |
| Fretboard width | 1776 px | 1778 px | Pass, +2 px |
| Fretboard height | 449 px | 450 px | Pass, +1 px |
| Chord card x/y | 72 / 1226 px | 71 / 1226 px | Pass |
| Chord card width | 480 px | 480 px | Pass |
| Transport x/y | 648 / 1450 px | 643 / 1436 px | Pass, −5 / −14 px |
| Transport height | 352 px | 352 px | Pass |

## State evidence

Browser checks seek to G, C, D, and Em positions and assert that each state has:

- the same current chord in the root state, Now card, hero readout, and chord card;
- exactly one active strum;
- exactly one active lyric word and moving caret while a word is sounding;
- the expected number and values of current finger markers;
- current markers at calibrated fret-cell and string centers;
- matching previous and next states.

The full four-phrase × three-speed loop matrix is recorded in
`ENGINEERING_GRAPH.md` along with data, cache, transport, and failure-state
evidence.
