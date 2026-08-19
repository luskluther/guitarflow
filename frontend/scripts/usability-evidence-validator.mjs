import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { median, summarizeUsabilityRecords } from "../public/usability-scoring.js";
import { PARTICIPANT_LANGUAGE_OPTIONS, PROTOCOL_VERSION, QUESTION_DEFS, TASKS, USABILITY_SCHEMA } from "../public/usability-protocol.js";

const QUESTION_KEYS = QUESTION_DEFS.map((question) => question.key);
const TASK_KEYS = TASKS.map((task) => task.key);
const PARTICIPANT_LANGUAGES = PARTICIPANT_LANGUAGE_OPTIONS.map((language) => language.value);
const QUESTION_VALUES = Object.fromEntries(QUESTION_DEFS.map((question) => [question.key, question.options.map((option) => typeof option === "string" ? option : option.value)]));

export function validateUsabilityEvidence(report) {
  const errors = [];
  if (report?.schema !== USABILITY_SCHEMA) errors.push(`schema must be ${USABILITY_SCHEMA}`);
  if (report?.protocolVersion !== PROTOCOL_VERSION) errors.push(`protocolVersion must be ${PROTOCOL_VERSION}`);
  if (!Array.isArray(report?.records)) return { pass: false, errors: [...errors, "records must be an array"], summary: null };
  const ids = new Set();
  for (const [index, record] of report.records.entries()) {
    const at = `records[${index}]`;
    if (!record?.participantId || ids.has(record.participantId)) errors.push(`${at}.participantId must be present and unique`);
    ids.add(record?.participantId);
    if (record?.eligible) {
      if (!["new", "beginner"].includes(record.experience)) errors.push(`${at}.experience is not beginner-eligible`);
      if (record.unfamiliar !== true) errors.push(`${at}.unfamiliar must be true`);
      if (record.consent !== true) errors.push(`${at}.consent must be true`);
    }
    if (!PARTICIPANT_LANGUAGES.includes(record?.protocolLanguage)) errors.push(`${at}.protocolLanguage must be one of ${PARTICIPANT_LANGUAGES.join(", ")}`);
    if (!Number.isFinite(Date.parse(record.startedAt)) || !Number.isFinite(Date.parse(record.completedAt)) || Date.parse(record.completedAt) < Date.parse(record.startedAt)) errors.push(`${at} has invalid session timestamps`);
    const responses = record?.comprehension?.responses;
    if (!Array.isArray(responses) || responses.length !== QUESTION_KEYS.length) {
      errors.push(`${at}.comprehension.responses must contain five answers`);
    } else {
      for (const key of QUESTION_KEYS) {
        const response = responses.find((item) => item.key === key);
        if (!response) { errors.push(`${at} is missing ${key}`); continue; }
        if (!Number.isFinite(response.responseMs) || response.responseMs < 0 || response.responseMs > 60000) errors.push(`${at}.${key}.responseMs is invalid`);
        if (typeof response.expected !== "string" || typeof response.answer !== "string") errors.push(`${at}.${key} must retain expected and answer strings`);
        else if (!QUESTION_VALUES[key].includes(response.expected) || !QUESTION_VALUES[key].includes(response.answer)) errors.push(`${at}.${key} must use canonical protocol values`);
        if (response.correct !== (response.answer === response.expected)) errors.push(`${at}.${key}.correct does not match answer equality`);
      }
      const computedMedian = Math.round(median(responses.map((response) => response.responseMs)));
      if (record.comprehension.medianMs !== computedMedian) errors.push(`${at}.comprehension.medianMs does not match raw responses`);
      if (record.comprehension.allCorrect !== responses.every((response) => response.correct)) errors.push(`${at}.comprehension.allCorrect does not match raw responses`);
    }
    const tasks = record?.tasks;
    if (!Array.isArray(tasks) || tasks.length !== TASK_KEYS.length || !TASK_KEYS.every((key) => tasks.filter((task) => task.key === key && typeof task.success === "boolean").length === 1)) errors.push(`${at}.tasks must contain each of the seven task outcomes exactly once`);
    else {
      const computedRate = tasks.filter((task) => task.success).length / TASK_KEYS.length;
      if (Math.abs(record.taskSuccessRate - computedRate) > 1e-9) errors.push(`${at}.taskSuccessRate does not match raw tasks`);
    }
    if (!["none", "P2", "P1", "P0"].includes(record.severity)) errors.push(`${at}.severity is invalid`);
    if (record.noP0P1 !== ["none", "P2"].includes(record.severity)) errors.push(`${at}.noP0P1 does not match severity`);
  }
  const summary = summarizeUsabilityRecords(report.records);
  if (summary.eligibleCount !== 5) errors.push(`exactly five eligible beginner records are required; found ${summary.eligibleCount}`);
  for (const [node, computed] of [["h1", summary.h1Pass], ["c4", summary.c4Pass], ["s3", summary.s3Pass]]) {
    if (report[node]?.pass !== computed) errors.push(`${node}.pass does not match recomputed evidence`);
  }
  return { pass: errors.length === 0 && summary.h1Pass && summary.c4Pass && summary.s3Pass, errors, summary };
}

export function formatEvidenceSummary(result, sourcePath = "evidence JSON") {
  const summary = result.summary;
  const lines = ["# GuitarFlow beginner validation audit", "", `Source: \`${sourcePath}\``, ""];
  if (summary) {
    lines.push(`- Eligible beginners: ${summary.eligibleCount}/5`);
    lines.push(`- H1: ${summary.h1Pass ? "PASS" : "FAIL"} — ${summary.primaryCorrectParticipants}/5 correct; ${summary.cohortMedianMs}ms cohort median`);
    lines.push(`- C4: ${summary.c4Pass ? "PASS" : "FAIL"} — ${summary.comprehensionPasses}/5 complete comprehension passes`);
    lines.push(`- S3: ${summary.s3Pass ? "PASS" : "FAIL"} — ${Math.round(summary.taskSuccessRate * 100)}% unassisted; no P0/P1: ${summary.noP0P1 ? "yes" : "no"}`);
  }
  lines.push("", `Overall: **${result.pass ? "PASS" : "FAIL"}**`);
  if (result.errors.length) lines.push("", "## Validation errors", "", ...result.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const sourcePath = process.argv[2];
  if (!sourcePath || sourcePath === "--help" || sourcePath === "-h") {
    const message = "Usage: node scripts/usability-evidence-validator.mjs <guitarflow-usability-results.json>";
    if (sourcePath) console.log(message); else console.error(message);
    process.exit(sourcePath ? 0 : 2);
  }
  let report;
  try { report = JSON.parse(fs.readFileSync(sourcePath, "utf8")); }
  catch (error) { console.error(`Could not read evidence: ${error.message}`); process.exit(2); }
  const result = validateUsabilityEvidence(report);
  process.stdout.write(formatEvidenceSummary(result, sourcePath));
  process.exit(result.pass ? 0 : 1);
}
