# GuitarFlow UI Spec — Chord Mode MVP v1

## Product sentence
Turn any song into a slowed-down, visual guitar lesson you can play along with — showing the exact on-neck placement and movement in sync with the music.

## Design intent
A single-screen visual guitar tutor, not a DAW, tab library, dashboard, or notation editor. The user should understand the screen within seconds: what to play, where to place the hand, when to change, how to strum, and what comes next.

## Visual language
- Bright white / warm-white background.
- Charcoal/black stable text.
- Subtle gray separators and inactive context.
- One orange accent.
- Orange means **do this now**: active lyric timing point, active chord change, current strum, current finger/string contact, active transport emphasis.
- Past = very light gray.
- Upcoming = medium gray / ghosted.
- Premium, restrained, near Apple-quality spacing and typography.
- No gradients, loud cards, gamification, DAW waveforms, sidebars, social elements, or decorative clutter.

## Screen structure
### 1. Quiet header
Show:
- song title
- artist
- mode (`Chords`)
- difficulty (`Beginner` initially)
- playback speed
- capo state
- loop state
- minimal overflow/settings control

Header should be thin and quiet.

### 2. Lyrics + chord timing
Always show two lyric lines:
- current line
- next line

Chord labels sit directly above the relevant lyric timing position.
When data quality permits, align a chord change to the exact syllable/letter at which it occurs, not merely the start of the word.

Visual timing:
- passed lyric = light gray
- current phrase = dark
- exact timing point = orange
- upcoming = medium gray

Avoid karaoke styling. This is a musician timing guide.

### 3. Compact tab/reference panel
Upper-right or similar secondary area.
Show only:
- Past
- Now
- Next

Keep it compact. In Chord mode this may show fret/chord reference. It becomes more important in future Lead mode.

### 4. Main fretboard hero
This is the visual anchor.
- Large guitar neck.
- Slightly tilted.
- Viewed from above like a player looking down while learning.
- Low E/thick string at bottom.
- High E/thin string at top.
- Clear fret numbers.
- Subtle fret markers.
- Realistic enough to understand physically, but instructional rather than photorealistic.

### 5. Transparent hand guidance
Use a plausible human fretting hand.
- Semi-transparent so strings/frets remain visible.
- Standard numbering: 1 index, 2 middle, 3 ring, 4 pinky.
- Thumb may be shown where musically appropriate.

Temporal states:
- Previous: very faint.
- Current: clearest and most readable.
- Next: ghosted preview.

For MVP, correct positions matter more than perfect biomechanical animation.

### 6. Chord context panel
Show:
- current chord
- next chord
- compact chord diagrams
- strumming pattern

Current strum is orange. Past strums fade; upcoming strums remain visible and quiet.

### 7. Playback timeline and transport
Keep transport minimal:
- previous/restart phrase
- play/pause
- next phrase
- speed
- loop
- guitar-part level
- Original / Practice

Practice mix should permit adjustable guitar level, not just mute/unmute.

Keyboard hints may be subtle:
- Space = Play/Pause
- L = Loop

## Interaction rules
- The fretboard never stops being the main anchor.
- Context changes by mode later; the structural shell stays familiar.
- UI should answer six questions at a glance:
  1. What do I play now?
  2. Where do I place my hand?
  3. When do I change?
  4. How do I strum?
  5. What comes next?
  6. Can I slow/loop/reduce the original guitar and practice it?

## Beginner behavior
Beginner is not merely slower playback.
Prefer, in order:
1. easier voicing
2. capo if useful
3. fewer embellishments/extensions
4. easier hand position
5. simpler strumming
6. only then harmonic simplification if necessary

Preserve the song’s harmonic identity whenever practical.

## Future contextual modes
### Lead/Solo
Replace chord-centric context with:
- synchronized TAB
- exact fret/string positions
- bends/slides/hammer-ons/pull-offs/vibrato
- current pentatonic/scale shape
- next position shift

### Fingerstyle
Show:
- fretboard + hand
- TAB
- chord/harmony context
- melody vs bass relationship
- later, right-hand P/I/M/A guidance

### Jam/Noodle
Show:
- current chord
- key
- pentatonic/full scale map
- chord tones / target notes
- optional suggested licks
