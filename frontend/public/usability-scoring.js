import { PROTOCOL_VERSION, USABILITY_SCHEMA } from "./usability-protocol.js";

export const PRIMARY_COMPREHENSION_KEYS = ["currentChord", "currentStroke", "nextChord"];

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeUsabilityRecords(records) {
  const eligible = records.filter((record) => record.eligible).slice(0, 5);
  const comprehensionPasses = eligible.filter((record) => record.comprehension.allCorrect && record.comprehension.medianMs <= 1000).length;
  const primaryResponses = eligible.flatMap((record) => record.comprehension.responses.filter((response) => PRIMARY_COMPREHENSION_KEYS.includes(response.key)));
  const primaryCorrectParticipants = eligible.filter((record) => record.comprehension.responses.filter((response) => PRIMARY_COMPREHENSION_KEYS.includes(response.key)).every((response) => response.correct)).length;
  const cohortMedianMs = Math.round(median(primaryResponses.map((response) => response.responseMs)));
  const taskOutcomes = eligible.flatMap((record) => record.tasks);
  const taskSuccessRate = taskOutcomes.length ? taskOutcomes.filter((task) => task.success).length / taskOutcomes.length : 0;
  const noP0P1 = eligible.length === 5 && eligible.every((record) => record.noP0P1);
  const h1Pass = eligible.length === 5 && primaryCorrectParticipants >= 4 && cohortMedianMs <= 1000;
  const c4Pass = eligible.length === 5 && comprehensionPasses >= 4;
  const s3Pass = eligible.length === 5 && taskSuccessRate >= .8 && noP0P1;
  return { eligible, eligibleCount: eligible.length, comprehensionPasses, primaryCorrectParticipants, cohortMedianMs, taskSuccessRate, noP0P1, h1Pass, c4Pass, s3Pass };
}

export function buildUsabilityReport(records, environment, exportedAt = new Date().toISOString()) {
  const summary = summarizeUsabilityRecords(records);
  return {
    schema: USABILITY_SCHEMA,
    protocolVersion: PROTOCOL_VERSION,
    exportedAt,
    fixture: "Good Riddance (Time of Your Life), 30-second cached lesson",
    environment,
    eligibleParticipants: summary.eligibleCount,
    h1: { pass: summary.h1Pass, correctParticipants: summary.primaryCorrectParticipants, medianPrimaryResponseMs: summary.cohortMedianMs },
    c4: { pass: summary.c4Pass, passingParticipants: summary.comprehensionPasses },
    s3: { pass: summary.s3Pass, unassistedTaskSuccessRate: summary.taskSuccessRate, noP0P1: summary.noP0P1 },
    records,
  };
}
