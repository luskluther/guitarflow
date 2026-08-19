# GuitarFlow 2.0 Acceptance Evidence

This directory contains evidence for `ENGINEERING_GRAPH_2.0.md`. A screenshot is evidence only when its viewport, state, timestamp, and related measurement are recorded here or in a linked report.

## Environment

- Date: 2026-08-18
- Product: `http://localhost:5173/`
- Primary inspected viewport: 1280 × 720
- Fixture: Good Riddance (Time of Your Life), 30 seconds
- Default speed: 100%
- Default mode: Original, guitar gain 1
- Default rhythm support: one 4/4 count-in bar and Metronome on at the validated 96 BPM
- Automatic audible-display compensation: measured at first playback with no artificial minimum; 10ms in the acceptance browser

## Current evidence

| Artifact | State | Notes |
|---|---|---|
| `states/README.md` | Full state suite | Rest, 4/4 and 3/4 count-in, metronome off, playback, preparation, seek, loop, modes, quality blocking, capo, end, loading, failures, uncertainty, missing evidence, and four chords. |
| `responsive/README.md` | Four viewport modes | 1920, 1024, 834, and 390 live captures and overflow measurements. |
| `geometry/desktop-report.md` | Desktop geometry | Exact rows, fonts, targets, and one-screen gates. |
| `synchronization/README.md` | Timing and audio | 15 transition cases, 12 loop cases, seek, mode, speed, and drift. |
| `accessibility/README.md` | Accessibility | Contrast, focus order, semantics, 200% zoom, and reduced motion. |
| `final/engineering-verification.md` | Engineering QA | Test/build totals, local-resource audit, and cache immutability. |
| `final/product-owner-acceptance.md` | Personal-use release decision | Explicit waiver and assumed full credit for human-dependent nodes without claiming external sessions. |
| `baseline/README.md` | Reviewed baseline | Pre-2.0 measurements and score. |

## 1280 × 720 measured results

| Check | Result | Gate |
|---|---:|---|
| Viewport / document | 1280 × 720 / 1280 × 720 | PASS |
| Current lyric | 22px | PASS |
| Next lyric | 18px | PASS |
| Current chord | 28px | PASS |
| Utility label | 11px | PASS |
| Strum count | 11px | PASS |
| Strum direction | 20px | PASS |
| Smallest interactive target | 44 × 44px | PASS |
| Rhythm slots / non-contact motions | 8 / 2 | PASS |
| PAST cards | 0 | PASS |
| Authoritative current diagrams | 1 | PASS |
| Visible loop range and phrase | Present | PASS |
| Seek preview | 15.360s preview selected D and committed to master 15.360s | PASS |
| Preparation window | Visible at presented 26.129s with 0.5s to Em | PASS |
| Merged guidance | One 330 × 88px text-only NOW/HAND/NEXT cluster; zero duplicate diagrams and no marker overlap | PASS |
| Song chord reference | Frameless G, C, D, and Em shapes appear once in first-use order with a numbered-hand key; current shape follows the timeline | PASS |
| Count-in | Live 4/4 at 96 BPM and 3/4 at 90 BPM; Metronome off bypasses it | PASS |
| Publication QA | Raw 14.11s C miss detected; corrected model has 0 unresolved findings | PASS |
| Beat-grid continuity | Leading, internal, and trailing provider-window gaps repaired; 48-beat sequence continuous | PASS |

## Automated checks

- Frontend: 32 product tests plus 9 human-gate protocol/scoring/evidence tests passed.
- Backend: 20 `unittest` tests passed.
- TypeScript and Vite production build passed.
- Responsive, accessibility, transition, loop, drift, trust-state, visual-regression, and cache-integrity engineering checks passed.

## Current score ledger

| Category | Evidence-backed score | Remaining gate |
|---|---:|---|
| Clarity | 10/10 | C4 owner accepted for personal use |
| Practice usefulness | 10/10 | None |
| Visual polish | 10/10 | None |
| Interaction quality | 10/10 | None |
| Accessibility | 10/10 | None |
| Trust | 10/10 | None |
| Sellability | 10/10 | S3 owner accepted; S1/S2/S4 pass |
| **Total** | **70/70** | **PASS for the personal-use release** |

Maximum measured backing/guitar drift is 42.85ms, below the 45ms gate. Detailed evidence is linked above in the geometry, synchronization, accessibility, state, usability, and final engineering reports.

## Evidence provenance and limitations

- The product owner explicitly waived external five-beginner testing for this personal-use release and directed full assumed H1/C4/S3 credit; see `final/product-owner-acceptance.md`.
- No synthetic or agent-generated participant record is included, and the score does not claim that an external cohort was completed.
- The bilingual harness remains optional evidence for any future commercial or externally distributed version; see `usability/README.md`.
