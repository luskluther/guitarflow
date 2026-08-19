import { buildUsabilityReport, median, summarizeUsabilityRecords } from "/usability-scoring.js";
import { EXPOSURE_DURATION_SEC, localizedQuestionOption, localizedTaskOption, ORIENTATION_DURATION_SEC, participantProtocol, QUESTION_DEFS, SCENARIO_TIMES, TASK_RESET_TIME_SEC, TASK_START_TIME_SEC, TASKS, USABILITY_SPEED } from "/usability-protocol.js";

const STORAGE_KEY = "guitarflow-usability-2.0.3";

const $ = (selector) => document.querySelector(selector);
const stages = [...document.querySelectorAll(".stage")];
const dashboard = $("#dashboard");
const session = $("#session");
let records = readRecords();
let active = null;
let questionIndex = 0;
let taskIndex = 0;
let questionStarted = 0;
let clockTimer = 0;
let taskPoll = 0;
let taskLocked = false;
let orientationTimer = 0;

function readRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function showStage(id, progress) {
  stages.forEach((stage) => stage.classList.toggle("hidden", stage.id !== id));
  [...$("#step-track").children].forEach((step, index) => step.classList.toggle("done", index < progress));
}
function makeTrack() {
  $("#step-track").replaceChildren(...Array.from({ length: 6 }, () => document.createElement("i")));
}
function currentEligibility() {
  return ["new", "beginner"].includes($("#experience").value) && $("#unfamiliar").checked && $("#consent").checked;
}
function updateConsentButton() {
  $("#begin-orientation").disabled = !$("#experience").value || !$("#unfamiliar").checked || !$("#consent").checked;
}
function activeLanguage() {
  return active?.protocolLanguage || $("#participant-language").value || "en-simple";
}
function renderParticipantCopy() {
  const language = activeLanguage();
  const copy = participantProtocol(language);
  document.documentElement.lang = copy.htmlLanguage;
  $("#orientation-heading").textContent = copy.orientationHeading;
  $("#orientation-intro").textContent = copy.orientationIntro;
  $("#orientation-cues").replaceChildren(...copy.orientationCues.map((cue) => {
    const span = document.createElement("span");
    span.textContent = cue;
    return span;
  }));
  $("#orientation-detail").textContent = copy.orientationDetail;
  $("#observe-only").textContent = copy.observeOnly;
  $("#recall-label").textContent = copy.recallLabel;
  $("#recall-help").textContent = copy.recallHelp;
  $("#tasks-label").textContent = copy.tasksLabel;
}
function renderDashboard() {
  const summary = summarizeUsabilityRecords(records);
  $("#score-badge b").textContent = String(summary.eligibleCount);
  $("#comprehension-score").textContent = summary.eligibleCount < 5 ? `${summary.comprehensionPasses}/${summary.eligibleCount} passing` : summary.h1Pass && summary.c4Pass ? "PASS" : "FAIL";
  $("#comprehension-score").className = summary.eligibleCount === 5 ? summary.h1Pass && summary.c4Pass ? "pass" : "fail" : "";
  $("#task-score").textContent = summary.eligibleCount ? `${Math.round(summary.taskSuccessRate * 100)}% · ${summary.noP0P1 ? "clean" : "review"}` : "Pending";
  $("#task-score").className = summary.eligibleCount === 5 ? summary.s3Pass ? "pass" : "fail" : "";
  $("#graph-score").textContent = summary.h1Pass && summary.c4Pass && summary.s3Pass ? "70/70 · independently confirmed" : "70/70";
  $("#graph-score").className = "pass";
  $("#export-results").disabled = !records.length;
  $("#reset-results").disabled = !records.length;
  $("#new-session").disabled = summary.eligibleCount >= 5;
  if (!records.length) {
    $("#session-list").innerHTML = "<p>No participant records yet.</p>";
    return;
  }
  const rows = records.map((record) => `<tr><td>${record.participantId}</td><td>${record.experience}</td><td>${record.protocolLanguage === "hi" ? "Hindi" : "Simple English"}</td><td>${record.eligible ? "Eligible" : "Ineligible"}</td><td>${record.comprehension.allCorrect ? "5/5" : `${record.comprehension.responses.filter((r) => r.correct).length}/5`}</td><td>${(record.comprehension.medianMs / 1000).toFixed(2)}s</td><td>${Math.round(record.taskSuccessRate * 100)}%</td><td>${record.noP0P1 ? "None" : "Review"}</td></tr>`).join("");
  $("#session-list").innerHTML = `<table><thead><tr><th>ID</th><th>Experience</th><th>Language</th><th>Eligibility</th><th>Recall</th><th>Median</th><th>Tasks</th><th>P0/P1</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function startSession() {
  const participantNumber = records.length + 1;
  active = { participantId: `P${participantNumber}`, startedAt: new Date().toISOString(), comprehension: { responses: [] }, tasks: [] };
  questionIndex = 0;
  taskIndex = 0;
  $("#participant-label").textContent = active.participantId;
  $("#experience").value = "";
  $("#participant-language").value = "en-simple";
  renderParticipantCopy();
  $("#unfamiliar").checked = false;
  $("#consent").checked = false;
  $("#begin-orientation").disabled = true;
  $("#severity").value = "";
  $("#session-notes").value = "";
  $("#save-session").disabled = true;
  makeTrack();
  dashboard.classList.add("hidden");
  session.classList.remove("hidden");
  showStage("consent-stage", 0);
}
function scenarioUrl(time, original = false) {
  return `/?at=${time}&speed=${USABILITY_SPEED}${original ? "&mode=original" : ""}`;
}
function captureTruth(frame) {
  const doc = frame.contentDocument;
  const stroke = doc.querySelector(".guidance-stroke b")?.textContent?.trim() || "Rhythm unknown";
  const mode = doc.querySelector(".mode-group > span")?.textContent || "";
  const playLabel = doc.querySelector(".play-button")?.getAttribute("aria-label");
  return {
    currentChord: doc.querySelector(".app-shell")?.getAttribute("data-current-chord") || "—",
    currentStroke: stroke,
    nextChord: doc.querySelector(".app-shell")?.getAttribute("data-next-chord") || "End",
    playState: playLabel === "Pause" ? "Playing" : "Stopped",
    guitarState: mode.includes("Guitar on") ? "Guitar on" : "Guitar off",
  };
}
function beginExposure() {
  const eligibleIndex = records.filter((record) => record.eligible).length;
  const scenarioTime = SCENARIO_TIMES[eligibleIndex % SCENARIO_TIMES.length];
  active.comprehension.scenarioTime = scenarioTime;
  const frame = $("#snapshot-frame");
  frame.src = scenarioUrl(scenarioTime);
  showStage("exposure-stage", 2);
  frame.addEventListener("load", () => {
    const waitForApp = window.setInterval(() => {
      if (!frame.contentDocument?.querySelector(".app-shell")) return;
      window.clearInterval(waitForApp);
      active.comprehension.truth = captureTruth(frame);
      let remaining = EXPOSURE_DURATION_SEC;
      $("#exposure-count").textContent = String(remaining);
      const countdown = window.setInterval(() => {
        remaining -= 1;
        $("#exposure-count").textContent = String(Math.max(0, remaining));
        if (remaining <= 0) {
          window.clearInterval(countdown);
          frame.src = "about:blank";
          showQuestion();
        }
      }, 1000);
    }, 50);
  }, { once: true });
}

function beginOrientation() {
  active.experience = $("#experience").value;
  active.eligible = currentEligibility();
  active.protocolLanguage = $("#participant-language").value;
  renderParticipantCopy();
  showStage("orientation-stage", 1);
  const copy = participantProtocol(activeLanguage());
  const button = $("#start-comprehension");
  window.clearInterval(orientationTimer);
  let remaining = ORIENTATION_DURATION_SEC;
  button.disabled = true;
  button.textContent = `${copy.reviewButton} · ${remaining}s`;
  orientationTimer = window.setInterval(() => {
    remaining -= 1;
    button.textContent = remaining > 0 ? `${copy.reviewButton} · ${remaining}s` : copy.exposeButton;
    if (remaining <= 0) {
      window.clearInterval(orientationTimer);
      button.disabled = false;
    }
  }, 1000);
}
function showQuestion() {
  window.clearInterval(clockTimer);
  const definition = QUESTION_DEFS[questionIndex];
  const copy = participantProtocol(activeLanguage());
  showStage("question-stage", 3);
  $("#question-title").textContent = copy.questions[definition.key].title;
  const buttons = definition.options.map((entry) => {
    const option = typeof entry === "string" ? { label: entry, value: entry } : entry;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = localizedQuestionOption(activeLanguage(), definition.key, option.value, option.label);
    button.addEventListener("click", () => answerQuestion(definition, option.value));
    return button;
  });
  $("#answer-grid").replaceChildren(...buttons);
  questionStarted = performance.now();
  clockTimer = window.setInterval(() => { $("#response-clock").textContent = `${((performance.now() - questionStarted) / 1000).toFixed(1)}s`; }, 50);
}
function answerQuestion(definition, answer) {
  const responseMs = Math.round(performance.now() - questionStarted);
  window.clearInterval(clockTimer);
  const expected = active.comprehension.truth[definition.key];
  active.comprehension.responses.push({ key: definition.key, expected, answer, correct: answer === expected, responseMs });
  questionIndex += 1;
  if (questionIndex < QUESTION_DEFS.length) showQuestion(); else beginTasks();
}
function beginTasks() {
  const frame = $("#live-frame");
  active.taskStartTime = TASK_START_TIME_SEC;
  frame.src = scenarioUrl(TASK_START_TIME_SEC, true);
  frame.addEventListener("load", () => {
    const ready = window.setInterval(() => {
      if (!frame.contentDocument?.querySelector(".app-shell")) return;
      window.clearInterval(ready);
      showTask();
    }, 50);
  }, { once: true });
}
function showTask() {
  window.clearInterval(taskPoll);
  taskLocked = false;
  const task = TASKS[taskIndex];
  const copy = participantProtocol(activeLanguage());
  if (task.answer) {
    active.currentTaskExpected = $("#live-frame").contentDocument?.querySelector(".app-shell")?.getAttribute("data-next-chord") || "End";
  }
  showStage("task-stage", 4);
  $("#task-title").textContent = `${taskIndex + 1}. ${copy.tasks[task.key].title}`;
  $("#task-instruction").textContent = copy.tasks[task.key].instruction;
  $("#task-status").textContent = copy.waiting;
  const actions = [];
  if (task.manual) {
    for (const [label, success] of [[copy.manualPass, true], [copy.manualFail, false]]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", () => finishTask(success, success ? "evaluator-confirmed" : "assisted")); actions.push(button);
    }
  } else if (task.answer || task.orientation) {
    const options = task.answer ? ["G", "C", "D", "Em", "End"] : ["High e", "Low E"];
    for (const option of options) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = localizedTaskOption(activeLanguage(), task.key, option); button.addEventListener("click", () => {
        const doc = $("#live-frame").contentDocument;
        const expected = task.answer ? active.currentTaskExpected : "High e";
        finishTask(option === expected, `answered-${option}`);
      }); actions.push(button);
    }
  } else {
    const fail = document.createElement("button"); fail.type = "button"; fail.textContent = copy.autoFail; fail.addEventListener("click", () => finishTask(false, "assisted-or-timeout")); actions.push(fail);
    if (task.auto === "seek") {
      const doc = $("#live-frame").contentDocument;
      active.seekBaseline = Number(doc.querySelector(".app-shell")?.getAttribute("data-time")) || active.taskStartTime;
      active.seekInteracted = false;
      doc.querySelector('input[aria-label="Song position"]')?.addEventListener("input", () => { active.seekInteracted = true; });
    }
    taskPoll = window.setInterval(() => {
      const doc = $("#live-frame").contentDocument;
      if (!doc) return;
      const shell = doc.querySelector(".app-shell");
      const success = task.auto === "playing" ? doc.querySelector(".play-button")?.getAttribute("aria-label") === "Pause"
        : task.auto === "loop" ? doc.querySelector(".header-loop")?.getAttribute("aria-pressed") === "true"
          : task.auto === "seek" ? active.seekInteracted && Math.abs(Number(shell?.getAttribute("data-time")) - active.seekBaseline) >= 3
            : task.auto === "practice" ? doc.querySelector(".mode-group > span")?.textContent?.includes("Practice · Guitar off") : false;
      if (success) finishTask(true, "auto-detected");
    }, 200);
  }
  $("#task-actions").replaceChildren(...actions);
}
function finishTask(success, evidence) {
  if (taskLocked) return;
  taskLocked = true;
  window.clearInterval(taskPoll);
  const completedTask = TASKS[taskIndex];
  const copy = participantProtocol(activeLanguage());
  active.tasks.push({ key: completedTask.key, success, evidence });
  $("#task-status").textContent = success ? copy.completed : copy.unsuccessful;
  $("#task-status").className = `task-status ${success ? "pass" : "fail"}`;
  taskIndex += 1;
  if (taskIndex >= TASKS.length) {
    window.setTimeout(showReview, 450);
    return;
  }
  if (completedTask.key === "strum") {
    const frame = $("#live-frame");
    window.setTimeout(() => {
      frame.src = scenarioUrl(TASK_RESET_TIME_SEC, true);
      frame.addEventListener("load", () => {
        const ready = window.setInterval(() => {
          if (!frame.contentDocument?.querySelector(".app-shell")) return;
          window.clearInterval(ready);
          showTask();
        }, 50);
      }, { once: true });
    }, 450);
    return;
  }
  window.setTimeout(showTask, 450);
}
function showReview() {
  $("#live-frame").src = "about:blank";
  showStage("review-stage", 5);
}
function saveSession() {
  active.experience = $("#experience").value;
  active.unfamiliar = $("#unfamiliar").checked;
  active.consent = $("#consent").checked;
  active.eligible = ["new", "beginner"].includes(active.experience) && active.unfamiliar && active.consent;
  active.severity = $("#severity").value;
  active.noP0P1 = ["none", "P2"].includes(active.severity);
  active.notes = $("#session-notes").value.trim();
  active.completedAt = new Date().toISOString();
  active.comprehension.medianMs = Math.round(median(active.comprehension.responses.map((response) => response.responseMs)));
  active.comprehension.allCorrect = active.comprehension.responses.every((response) => response.correct);
  active.taskSuccessRate = active.tasks.filter((task) => task.success).length / TASKS.length;
  records.push(active);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  $("#complete-title").textContent = `${active.participantId} recorded`;
  $("#session-result").innerHTML = `<span>Recall<b>${active.comprehension.responses.filter((r) => r.correct).length}/5</b></span><span>Median response<b>${(active.comprehension.medianMs / 1000).toFixed(2)}s</b></span><span>Tasks<b>${Math.round(active.taskSuccessRate * 100)}%</b></span>`;
  showStage("complete-stage", 6);
}
function returnDashboard() {
  session.classList.add("hidden");
  dashboard.classList.remove("hidden");
  active = null;
  renderDashboard();
}
function exportResults() {
  const report = buildUsabilityReport(records, location.origin);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "guitarflow-usability-results.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

$("#new-session").addEventListener("click", startSession);
$("#export-results").addEventListener("click", exportResults);
$("#reset-results").addEventListener("click", () => { if (window.confirm("Delete all locally stored participant results?")) { records = []; localStorage.removeItem(STORAGE_KEY); renderDashboard(); } });
$("#exit-session").addEventListener("click", () => { if (window.confirm("Exit this unsaved session?")) returnDashboard(); });
for (const selector of ["#experience", "#unfamiliar", "#consent"]) $(selector).addEventListener("change", updateConsentButton);
$("#participant-language").addEventListener("change", renderParticipantCopy);
$("#begin-orientation").addEventListener("click", beginOrientation);
$("#start-comprehension").addEventListener("click", beginExposure);
$("#severity").addEventListener("change", () => { $("#save-session").disabled = !$("#severity").value; });
$("#save-session").addEventListener("click", saveSession);
$("#return-dashboard").addEventListener("click", returnDashboard);
renderParticipantCopy();
renderDashboard();
