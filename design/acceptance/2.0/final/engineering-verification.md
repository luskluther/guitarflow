# Engineering verification

Run on 2026-08-18.

| Check | Result |
|---|---|
| Final Graph 2.0 audit | PASS; no scored node or implementation step remains TODO/DOING/REVALIDATE |
| Personal-use score | 70/70; 59 measured engineering points plus 11 explicitly owner-accepted human-dependent points |
| Owner-acceptance provenance | PASS; `product-owner-acceptance.md` records the waiver and makes no external-study claim |
| Frontend unit/model suite | 32 passed |
| Human-gate protocol/scoring/evidence verifier | 9 passed |
| Frontend TypeScript + Vite production build | PASS |
| Backend `unittest` suite | 20 passed |
| Responsive live-browser matrix | PASS |
| Count-in/metronome matrix | PASS; bright two-voice audible ticks, stronger beat-1 accent, enable-preview tick, 4/4 count at 96 BPM, 3/4 count at 90 BPM, Off bypass, cancel at time 0, and counted restart |
| Default lesson state | PASS; 100%, Original · Guitar on, Metronome On |
| 15 live chord transitions | PASS, including the reviewed 14.11s C at all three speeds |
| Live “fork/stuck” state | PASS; 13.96s shows G + NEXT C, while 14.40s shows C in the lyric anchor, NOW label, hand pose, and active song-reference shape + NEXT D |
| Published lesson model | PASS; `data/song.json` and `frontend/public/song.json` share SHA-256 `8F5AB7B2EF61446B9A97239B00DB70E6C531A5064E3D693407702BA821EABC77` |
| Chord-model integrity | PASS; 20 ordered events, continuous event boundaries, disclosed C override at 14.11s, lesson end at 30.00s |
| Beat-grid integrity | PASS; 45 provider beats become a continuous 48-beat grid through three disclosed edge/gap repairs; derived beats never rewrite harmonic boundaries |
| Publication quality gate | PASS; cached guitar-audio audit independently finds the raw 14.11s C miss, unresolved raw data is blocked, and the reviewed model retains the finding with 0 unresolved |
| Capo projection | PASS; capo 5 fixture moves the visible capo and absolute finger markers to frets 7–8 without covering them; out-of-range shapes are rejected |
| 12 live loop/audio-drift cases | PASS; maximum drift 42.85ms |
| 4 authoritative chord captures | PASS |
| All-song chord reference | PASS; frameless G/C/D/Em rendered once in first-use order with player-view finger numbers and a hand-number key; G active at rest and C active after seeking to 14.40s; NOW/NEXT contains zero diagrams |
| 200% zoom equivalent | PASS |
| Interactive target audit | PASS; minimum 44 × 44 |
| Cache-only runtime sources | localhost model, fixtures, code, and local fretboard asset only |
| Cache immutability | 260 files; aggregate SHA-256 unchanged: `5341274E0421A038643CAAF0435891301419F536A0C5719DBE3E0A97FDCB4CC4` |
| Debug console statements in frontend source | none |
| Live browser application errors | none; only Vite connection and React development informational messages |

The running application does not call Klangio, ASR, or any external provider during playback. All provider and lyric artifacts remain read-only inputs.

The optional five-beginner collector is `/usability-test.html`. Protocol 2.0.3 tests the final 100%/Original layout, merged NOW/HAND/NEXT cluster, count-in, continuous MISS motions, seek, loop, and Practice state. Participant-facing wording can be Simple English or Hindi, while exported answers and task keys remain canonical and independently validated. For this personal-use release, the product owner waived external testing and assumed full H1/C4/S3 credit in `product-owner-acceptance.md`; no synthetic participant record or false external-study claim is included.
