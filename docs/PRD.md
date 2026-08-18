# GuitarFlow MVP PRD v1.0

## Product summary
GuitarFlow turns a user-supplied song into a synchronized visual guitar lesson. The application is not a tab marketplace, public song library, DAW, or notation editor. It analyzes a song for private learning and lets the user save/open the resulting project locally.

## Core promise
**Turn any song into a slowed-down, visual guitar lesson you can play along with — showing the exact on-neck placement and movement in sync with the music.**

## Long-term vision
Give a guitarist any song and show them the most appropriate way to play it for their current ability.

Future modes:
- Chords
- Lead/Solo
- Fingerstyle
- Jam/Noodle
- personalized difficulty
- adaptive practice/feedback

## Product principles
1. Show, do not explain.
2. One screen, one current action.
3. Fretboard is the visual anchor.
4. Orange means “do this now.”
5. Anticipation is part of teaching: previous/current/next.
6. Preserve musical identity while adapting physical difficulty.
7. Keep transcription providers replaceable; own the normalized music model and guitar-learning layer.

## Initial target user
Beginner/intermediate guitarists who want to learn songs they already like and struggle with static tabs/chord sheets, timing chord changes, understanding fingering, or switching between multiple practice tools.

## MVP mode
**Chord Mode only.**

## MVP input
Required first:
- local audio upload (MP3/WAV or practical equivalent)

Later:
- YouTube URL
- song-name search + exact-version confirmation

## Main MVP screen
Single-screen practice UI containing:
- song/artist + mode/difficulty/speed/capo/loop
- two synchronized lyric lines
- chord names aligned to the exact relevant lyric point when data allows
- compact Past/Now/Next tab/reference strip
- angled player-view fretboard
- low E/thick string bottom, high E/thin string top
- fret numbers
- transparent hand guidance
- finger numbers
- previous/current/next hand states
- current/next chord diagrams
- synchronized strum pattern with active stroke in orange
- play/pause, speed, loop
- adjustable original-guitar percentage
- Original / Practice mode

## Practice mix
The part being learned is adjustable by percentage rather than only on/off.
Typical use:
- 100% = reference
- 50% = play along with guidance
- 25% = light reference
- 0% = user replaces the original guitar part

Other useful stems remain audible.

## Difficulty
### Beginner
Prefer easier execution while preserving the song:
- simpler voicing
- capo when useful
- fewer extensions/embellishments
- easier position
- simpler strumming
- only simplify harmonic identity if necessary

### Intermediate
Closer to the recorded performance with richer voicings/rhythm.

### Advanced/Original
Attempt to reflect the actual recorded part as closely as analysis quality allows.

## Core synchronization requirement
Audio, beat/bar clock, lyric timing, chord events, strum events, hand poses, next-pose preview, speed, loop, and practice mix must derive from one master timeline.

## Provider strategy
Use existing transcription/analysis providers first (Klangio is the initial candidate). Do not train a transcription model for MVP.

Normalize all provider output into a GuitarFlow-owned canonical song model so Klangio can later be replaced or supplemented.

## Local-first
MVP/prototype:
- no accounts
- no public library
- no community sharing
- no content marketplace
- no server-side song catalog
- local project save/open

## MVP success criteria
A guitarist can load one supported song, choose Beginner Chords, press Play, follow synchronized lyrics/chords/strumming/hand placement, slow or loop the song, reduce the original guitar, and meaningfully play along without another application.

## Primary technical proof
One real song/section must maintain convincing sync at 100%, 75%, and 50% speed across:
- audio
- lyric cue
- chord change
- strum cue
- hand placement
- next-hand preview
- loop
- guitar level

## Explicitly not MVP
- mobile/tablet app
- public song library
- sharing/community
- accounts/subscriptions
- gamification
- microphone scoring
- Lead mode
- Fingerstyle mode
- Jam mode
- perfect hand biomechanics
- personalized player model

## Future — Lead/Solo
Use the same visual shell with:
- synchronized TAB
- exact fret/string positions
- bends/slides/hammer-ons/pull-offs/vibrato
- current scale/pentatonic shape
- position shifts
- difficulty simplification that preserves recognizable melody

## Future — Fingerstyle
Generate playable solo-guitar arrangements from melody, harmony, bass movement, rhythm, and recognizable hooks.
Levels:
- Beginner: simple bass + chord tones + reduced melody
- Intermediate: more melody, richer harmony, moving bass
- Advanced: integrated bass/harmony/melody/hooks

Later show picking-hand P/I/M/A guidance.

## Future — Jam/Noodle
Show:
- current key/chord
- pentatonic/full scale map
- chord tones/target notes
- safe notes
- optional suggested licks

## Future — transition intelligence
Beyond current/next hand positions, teach efficient movement:
- keep finger 2 anchored
- pivot around a finger
- slide rather than lift
- prepare pinky early
- alternate voicing for faster transition
- visualize finger trajectories

## Future — personalized player model
A player may have different levels across chords, lead, rhythm, fingerstyle, bends, barre chords, etc. Long term, replace generic labels with: **Make this playable for me.**

## Future — performance listening
Potential later microphone feedback:
- correct chord/note
- timing accuracy
- missed notes
- rhythm stability
- transition timing

Then adapt practice automatically around weak spots.

## Long-term moat
Not transcription alone. Defensibility should come from:
1. guitar-specific physical intelligence
2. adaptive difficulty
3. transition intelligence
4. player model
5. synchronized visual teaching UX
6. eventual practice feedback

## Development order
1. Freeze design — complete
2. Technical feasibility spike — next
3. Stable Chord Mode MVP
4. Difficulty transformation engine
5. Lead/Solo
6. Fingerstyle
7. Jam/Noodle
8. Personalized/adaptive teaching
9. Dedicated mobile/tablet app after web proof
