export const USABILITY_SCHEMA = "guitarflow-usability-2.0.3";
export const PROTOCOL_VERSION = "2.0.3";
export const ORIENTATION_DURATION_SEC = 20;
export const EXPOSURE_DURATION_SEC = 5;
export const TASK_START_TIME_SEC = 0;
export const TASK_RESET_TIME_SEC = 12;
export const USABILITY_SPEED = 1;
export const SCENARIO_TIMES = [12, 15.7, 19.5, 22, 28];

export const PARTICIPANT_LANGUAGE_OPTIONS = [
  { value: "en-simple", label: "Simple English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
];

export const QUESTION_DEFS = [
  { key: "currentChord", title: "Which chord was shown under NOW?", options: ["G", "C", "D", "Em"] },
  { key: "currentStroke", title: "Which action was shown under HAND?", options: [{ label: "↓ Down", value: "Down" }, { label: "↑ Up", value: "Up" }, { label: "⇡ Move up · miss strings", value: "Move up · miss strings" }, { label: "⇣ Move down · miss strings", value: "Move down · miss strings" }] },
  { key: "nextChord", title: "Which chord was shown under NEXT?", options: ["G", "C", "D", "Em", "End"] },
  { key: "playState", title: "Was the music playing, or was it stopped?", options: ["Playing", "Stopped"] },
  { key: "guitarState", title: "Did the screen say Guitar on or Guitar off?", options: ["Guitar on", "Guitar off"] },
];

export const TASKS = [
  { key: "play", title: "Start the music", instruction: "Press the large Play button (▶), follow the count-in, and wait for the song to start.", auto: "playing" },
  { key: "strum", title: "Follow one strum pattern", instruction: "Keep the hand moving through all eight boxes: D · MISS · D U · MISS · U D U.", manual: true },
  { key: "next", title: "Read the NEXT chord", instruction: "Look at the box labelled NEXT, then choose that chord below.", answer: true },
  { key: "loop", title: "Repeat the current phrase", instruction: "Press Loop so it changes from Off to On (or Looping).", auto: "loop" },
  { key: "seek", title: "Move forward in the song", instruction: "Drag the song-position slider at least three seconds to the right.", auto: "seek" },
  { key: "practice", title: "Turn the guitar sound off", instruction: "Press Practice. The screen should say Guitar off.", auto: "practice" },
  { key: "orientation", title: "Read the Player View", instruction: "Look at the string labels. Which string is at the top?", orientation: true },
];

export const PARTICIPANT_PROTOCOLS = {
  "en-simple": {
    htmlLanguage: "en",
    orientationHeading: "What to look for",
    orientationIntro: "You will see the practice screen for five seconds. Find these five things:",
    orientationCues: ["Chord under NOW", "Action under HAND", "Chord under NEXT", "Music playing or stopped", "Guitar on or Guitar off"],
    orientationDetail: "Look at these five items for 20 seconds. Then the practice screen appears for five seconds. Answer each question as quickly as you can.",
    reviewButton: "Look at the five items",
    exposeButton: "Show practice screen for 5 seconds",
    observeOnly: "Look only — do not click",
    recallLabel: "QUICK QUESTIONS",
    recallHelp: "Choose one answer. The timer has started.",
    tasksLabel: "DO THESE WITHOUT HELP",
    waiting: "Waiting for the participant…",
    completed: "Completed without help.",
    unsuccessful: "Recorded as unsuccessful or helped.",
    manualPass: "Completed without help",
    manualFail: "Needed help / incorrect",
    autoFail: "Could not complete without help",
    questions: {
      currentChord: { title: "What chord was under NOW?" },
      currentStroke: { title: "What hand action was under HAND?", optionLabels: { Down: "↓ Down", Up: "↑ Up", "Move up · miss strings": "⇡ Move up · MISS strings", "Move down · miss strings": "⇣ Move down · MISS strings" } },
      nextChord: { title: "What chord was under NEXT?" },
      playState: { title: "Was the music playing or stopped?" },
      guitarState: { title: "Did the screen say Guitar on or Guitar off?" },
    },
    tasks: Object.fromEntries(TASKS.map((task) => [task.key, { title: task.title, instruction: task.instruction }])),
    taskOptionLabels: {},
  },
  hi: {
    htmlLanguage: "hi",
    orientationHeading: "क्या देखना है",
    orientationIntro: "Practice screen पाँच सेकंड के लिए दिखेगा। ये पाँच चीज़ें देखें:",
    orientationCues: ["NOW के नीचे chord", "HAND के नीचे action", "NEXT के नीचे chord", "Music चल रहा है या रुका है", "Guitar on या Guitar off"],
    orientationDetail: "इन पाँच चीज़ों को 20 सेकंड समझें। फिर practice screen पाँच सेकंड दिखेगा। हर सवाल का जवाब जितनी जल्दी हो सके दें।",
    reviewButton: "पाँच चीज़ें समझें",
    exposeButton: "Practice screen 5 सेकंड दिखाएँ",
    observeOnly: "सिर्फ देखें — click न करें",
    recallLabel: "जल्दी जवाब दें",
    recallHelp: "एक जवाब चुनें। Timer शुरू हो चुका है।",
    tasksLabel: "बिना मदद ये काम करें",
    waiting: "Participant का इंतज़ार है…",
    completed: "बिना मदद पूरा हुआ।",
    unsuccessful: "पूरा नहीं हुआ या मदद ली।",
    manualPass: "बिना मदद पूरा हुआ",
    manualFail: "मदद लगी / गलत हुआ",
    autoFail: "बिना मदद पूरा नहीं हुआ",
    questions: {
      currentChord: { title: "NOW के नीचे कौन-सा chord था?" },
      currentStroke: { title: "HAND के नीचे कौन-सा action था?", optionLabels: { Down: "↓ Down · हाथ नीचे", Up: "↑ Up · हाथ ऊपर", "Move up · miss strings": "⇡ ऊपर जाएँ · strings को MISS करें", "Move down · miss strings": "⇣ नीचे जाएँ · strings को MISS करें" } },
      nextChord: { title: "NEXT के नीचे कौन-सा chord था?" },
      playState: { title: "Music चल रहा था या रुका था?", optionLabels: { Playing: "चल रहा था", Stopped: "रुका था" } },
      guitarState: { title: "Screen पर Guitar on था या Guitar off?" },
    },
    tasks: {
      play: { title: "Music शुरू करें", instruction: "बड़ा Play button (▶) दबाएँ, 1–2–3–4 count सुनें, और song शुरू होने तक रुकें।" },
      strum: { title: "एक strum pattern करें", instruction: "हाथ को सभी आठ boxes में चलाते रहें: D · MISS · D U · MISS · U D U। MISS पर strings को न छुएँ।" },
      next: { title: "NEXT chord पढ़ें", instruction: "NEXT वाला box देखें, फिर नीचे वही chord चुनें।" },
      loop: { title: "Current phrase दोहराएँ", instruction: "Loop दबाएँ ताकि Off बदलकर On या Looping हो जाए।" },
      seek: { title: "Song में आगे जाएँ", instruction: "Song-position slider को कम से कम तीन सेकंड दाईं ओर खींचें।" },
      practice: { title: "Guitar sound बंद करें", instruction: "Practice दबाएँ। Screen पर Guitar off दिखना चाहिए।" },
      orientation: { title: "Player View पढ़ें", instruction: "String labels देखें। सबसे ऊपर कौन-सी string है?" },
    },
    taskOptionLabels: { orientation: { "High e": "High e · पतली string", "Low E": "Low E · मोटी string" } },
  },
};

export function participantProtocol(language) {
  return PARTICIPANT_PROTOCOLS[language] || PARTICIPANT_PROTOCOLS["en-simple"];
}

export function localizedQuestionOption(language, questionKey, value, fallback) {
  return participantProtocol(language).questions[questionKey]?.optionLabels?.[value] || fallback;
}

export function localizedTaskOption(language, taskKey, value) {
  return participantProtocol(language).taskOptionLabels[taskKey]?.[value] || value;
}
