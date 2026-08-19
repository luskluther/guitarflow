# Optional beginner validation protocol

External testing is optional for the personal-use release because the product owner explicitly waived it and assumed full H1/C4/S3 credit. Open [the local validation harness](http://localhost:5173/usability-test.html) only when independent beginner evidence is desired. Do not coach the participant after the 20-second orientation.

The harness:

- accepts anonymous sequential participant records and scores only the first five eligible beginners;
- marks experienced or previously familiar participants ineligible;
- rotates the lesson timestamp across eligible sessions;
- presents the real app for exactly five seconds;
- times each of the five recall questions separately;
- auto-detects Play, timeline seek, Loop, and Practice tasks in a real 1024 × 768 app iframe;
- records evaluator-confirmed strum performance and highest observed severity;
- calculates H1, C4, and S3 without rounding a failing result upward;
- stores results only in that browser and exports `guitarflow-usability-results.json`.

Protocol revision 2.0.3 removes the known language confound by offering Simple English and Hindi for all measured orientation, recall, and task wording. Localization changes display labels only: answers still export the same canonical chord/action values, tasks retain the same seven keys, timing and thresholds are identical, and every record declares its protocol language. It also uses the exact on-screen words “Guitar on/off,” asks about the merged NOW/HAND/NEXT cluster, distinguishes Down, Up, Move up · miss strings, and Move down · miss strings, uses the real 100%/Original defaults, includes the count-in in the Play task from 0:00, freezes the NEXT answer when its task starts, reloads the lesson at 0:12 after the strum task, and enforces the full 20-second orientation. Its export schema is `guitarflow-usability-2.0.3`; the verifier rejects earlier, mixed, unknown-language, or non-canonical evidence.

The protocol constants, two participant languages, five scenario timestamps, 100% speed, five questions, seven tasks, start/reset timestamps, schema, and visible hand-action labels now live in `frontend/public/usability-protocol.js`. The collector, scorer, independent validator, and nine Node tests consume that same contract. The refreshed dashboard, Hindi orientation, exposure, and evaluator-review screenshots contain no saved synthetic participant record; the walkthrough ended without saving a participant.

## Rejected legacy export

A 2026-08-19 `guitarflow-usability-2.0` export mixed the two original sessions with later records. Recomputed results were H1 `2/5`, C4 `0/5`, S3 `40%`, with no recorded P0/P1. It is retained only as diagnostic feedback and cannot score the graph because it both fails the thresholds and predates the corrected 2.0.3 protocol.

Do not use synthetic responses, the developer, anyone who has already reviewed the screen, or the same person more than once. Select the participant's preferred language before orientation and do not translate or coach beyond the supplied wording. After five eligible sessions, click **Export evidence JSON** and provide that file for the final graph audit. Screenshots of the validated harness are `harness-dashboard.jpg`, `harness-hindi-orientation.jpg`, `harness-exposure.jpg`, and `harness-review.jpg`.

Independently verify an exported file from `frontend/` with:

```powershell
npm run verify:usability -- "C:\path\to\guitarflow-usability-results.json"
```

The verifier recomputes all medians and success rates from raw answers/tasks, rejects duplicates, invalid eligibility, unsupported participant languages, non-canonical answer values, duplicate/missing tasks, missing timestamps, inconsistent correctness flags, altered summaries, and fewer than five eligible sessions.

## Five-second comprehension

Freeze a playback screenshot at an arbitrary non-transition moment. Ask: “What large chord is shown now, which hand action is shown now, what chord is under NEXT, is the music playing or stopped, and does the screen say Guitar on or Guitar off?” Record accuracy and response time for each item. C4 passes when at least four of five beginners answer all five correctly with median response time at or below one second after orientation.

## Complete-task session

Ask each beginner to: start the count-in and song; follow one full `D · MISS · D U · MISS · U D U` cycle while keeping the hand moving; identify the next chord; enable a phrase loop; seek to a later lyric; switch to Practice; and explain Player view string orientation. Record unassisted success, hesitation, wrong action, and comments. S3 passes at 80% or better unassisted task success with no P0/P1 finding.

The table below is a paper fallback only; prefer the harness and exported JSON.

| Participant | Language | Chord now | Stroke now | Chord next | Play state | Guitar state | Median recognition | Task success | P0/P1 |
|---|---|---|---|---|---|---|---:|---:|---|
| P1 |  |  |  |  |  |  |  |  |  |
| P2 |  |  |  |  |  |  |  |  |  |
| P3 |  |  |  |  |  |  |  |  |  |
| P4 |  |  |  |  |  |  |  |  |  |
| P5 |  |  |  |  |  |  |  |  |  |

For future independent or commercial validation, do not report an external H1/C4/S3 pass until these rows contain genuine participant observations. The current personal-use 70/70 score instead cites the explicit owner acceptance record.
