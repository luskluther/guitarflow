import assert from "node:assert/strict";
import test from "node:test";
import { buildUsabilityReport, median, summarizeUsabilityRecords } from "../public/usability-scoring.js";
import { EXPOSURE_DURATION_SEC, localizedQuestionOption, localizedTaskOption, ORIENTATION_DURATION_SEC, PARTICIPANT_LANGUAGE_OPTIONS, PARTICIPANT_PROTOCOLS, PROTOCOL_VERSION, QUESTION_DEFS, SCENARIO_TIMES, TASK_RESET_TIME_SEC, TASK_START_TIME_SEC, TASKS, USABILITY_SCHEMA, USABILITY_SPEED } from "../public/usability-protocol.js";
import { validateUsabilityEvidence } from "./usability-evidence-validator.mjs";

function participant(id, { correct = true, responseMs = 800, taskWins = 7, severity = "none", eligible = true } = {}) {
  const keys = ["currentChord", "currentStroke", "nextChord", "playState", "guitarState"];
  const truth = { currentChord: "G", currentStroke: "Down", nextChord: "C", playState: "Stopped", guitarState: "Guitar on" };
  const wrong = { currentChord: "C", currentStroke: "Up", nextChord: "D", playState: "Playing", guitarState: "Guitar off" };
  return {
    participantId: id,
    protocolLanguage: "en-simple",
    eligible,
    experience: "beginner",
    unfamiliar: true,
    consent: true,
    startedAt: "2026-08-18T00:00:00.000Z",
    completedAt: "2026-08-18T00:01:00.000Z",
    noP0P1: !["P0", "P1"].includes(severity),
    severity,
    comprehension: { allCorrect: correct, medianMs: responseMs, responses: keys.map((key) => ({ key, expected: truth[key], answer: correct ? truth[key] : wrong[key], correct, responseMs })) },
    tasks: ["play", "strum", "next", "loop", "seek", "practice", "orientation"].map((key, index) => ({ key, success: index < taskWins })),
    taskSuccessRate: taskWins / 7,
  };
}

test("median handles odd, even, and empty inputs", () => {
  assert.equal(median([]), 0);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test("protocol 2.0.3 keeps wording, timing, and task order in one contract", () => {
  assert.equal(USABILITY_SCHEMA, "guitarflow-usability-2.0.3");
  assert.equal(PROTOCOL_VERSION, "2.0.3");
  assert.equal(ORIENTATION_DURATION_SEC, 20);
  assert.equal(EXPOSURE_DURATION_SEC, 5);
  assert.equal(TASK_START_TIME_SEC, 0);
  assert.equal(TASK_RESET_TIME_SEC, 12);
  assert.equal(USABILITY_SPEED, 1);
  assert.deepEqual(SCENARIO_TIMES, [12, 15.7, 19.5, 22, 28]);
  assert.deepEqual(QUESTION_DEFS.map((question) => question.key), ["currentChord", "currentStroke", "nextChord", "playState", "guitarState"]);
  assert.deepEqual(TASKS.map((task) => task.key), ["play", "strum", "next", "loop", "seek", "practice", "orientation"]);
  assert.deepEqual(QUESTION_DEFS[1].options.map((option) => option.value), ["Down", "Up", "Move up · miss strings", "Move down · miss strings"]);
  assert.match(QUESTION_DEFS[1].options[0].label, /↓ Down/);
  assert.match(QUESTION_DEFS[1].options[2].label, /miss strings/);
  assert.match(TASKS[0].instruction, /Play/);
  assert.match(TASKS[0].instruction, /count-in/);
  assert.match(TASKS[1].instruction, /MISS/);
  assert.match(TASKS[5].instruction, /Guitar off/);
});

test("Simple English and Hindi preserve canonical answer and task semantics", () => {
  assert.deepEqual(PARTICIPANT_LANGUAGE_OPTIONS.map((language) => language.value), ["en-simple", "hi"]);
  for (const language of PARTICIPANT_LANGUAGE_OPTIONS.map((item) => item.value)) {
    const protocol = PARTICIPANT_PROTOCOLS[language];
    assert.deepEqual(Object.keys(protocol.questions), QUESTION_DEFS.map((question) => question.key));
    assert.deepEqual(Object.keys(protocol.tasks), TASKS.map((task) => task.key));
    for (const question of QUESTION_DEFS) assert.ok(protocol.questions[question.key].title.length > 5);
    for (const task of TASKS) {
      assert.ok(protocol.tasks[task.key].title.length > 2);
      assert.ok(protocol.tasks[task.key].instruction.length > 8);
    }
  }
  assert.equal(localizedQuestionOption("hi", "currentStroke", "Down", "↓ Down"), "↓ Down · हाथ नीचे");
  assert.equal(localizedTaskOption("hi", "orientation", "High e"), "High e · पतली string");
  assert.match(PARTICIPANT_PROTOCOLS.hi.questions.currentChord.title, /[\u0900-\u097F]/u);
});

test("five clean beginners pass H1, C4, and S3", () => {
  const summary = summarizeUsabilityRecords(Array.from({ length: 5 }, (_, index) => participant(`P${index + 1}`)));
  assert.equal(summary.h1Pass, true);
  assert.equal(summary.c4Pass, true);
  assert.equal(summary.s3Pass, true);
});

test("ineligible records never count toward the five-person gate", () => {
  const records = [participant("PX", { eligible: false }), ...Array.from({ length: 4 }, (_, index) => participant(`P${index + 1}`))];
  const summary = summarizeUsabilityRecords(records);
  assert.equal(summary.eligibleCount, 4);
  assert.equal(summary.h1Pass, false);
  assert.equal(summary.s3Pass, false);
});

test("a P1 or sub-80-percent task cohort fails S3", () => {
  const severityRecords = Array.from({ length: 5 }, (_, index) => participant(`P${index + 1}`, { severity: index === 0 ? "P1" : "none" }));
  assert.equal(summarizeUsabilityRecords(severityRecords).s3Pass, false);
  const weakTasks = Array.from({ length: 5 }, (_, index) => participant(`P${index + 1}`, { taskWins: 5 }));
  assert.equal(summarizeUsabilityRecords(weakTasks).s3Pass, false);
});

test("exported evidence carries explicit pass booleans and raw records", () => {
  const records = Array.from({ length: 5 }, (_, index) => participant(`P${index + 1}`));
  records[1].protocolLanguage = "hi";
  const report = buildUsabilityReport(records, "http://localhost:5173", "2026-08-18T00:00:00.000Z");
  assert.equal(report.schema, USABILITY_SCHEMA);
  assert.equal(report.protocolVersion, PROTOCOL_VERSION);
  assert.equal(report.h1.pass, true);
  assert.equal(report.c4.pass, true);
  assert.equal(report.s3.pass, true);
  assert.equal(report.records.length, 5);
  assert.equal(validateUsabilityEvidence(report).pass, true);
});

test("independent evidence validation rejects unsupported participant language", () => {
  const records = Array.from({ length: 5 }, (_, index) => participant(`P${index + 1}`));
  records[0].protocolLanguage = "unknown";
  const report = buildUsabilityReport(records, "http://localhost:5173", "2026-08-18T00:00:00.000Z");
  const result = validateUsabilityEvidence(report);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.includes("protocolLanguage")));
});

test("independent evidence validation rejects a tampered correctness flag", () => {
  const records = Array.from({ length: 5 }, (_, index) => participant(`P${index + 1}`));
  const report = buildUsabilityReport(records, "http://localhost:5173", "2026-08-18T00:00:00.000Z");
  report.records[0].comprehension.responses[0].correct = false;
  const result = validateUsabilityEvidence(report);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.includes("correct does not match")));
});
