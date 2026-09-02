import test from "node:test";
import assert from "node:assert/strict";
import {
  getAutomaticBatchRetryRetentionSeconds,
  getManilaAutomaticBatchCutoff,
  getNextManilaMidnight,
  hasAutomaticBatchDeadlinePassed,
} from "../lib/telegram-batch-schedule.ts";

test("calculates the next Manila midnight", () => {
  assert.equal(
    getNextManilaMidnight(new Date("2026-09-03T14:30:00.000Z")),
    "2026-09-03T16:00:00.000Z"
  );
});

test("stops new automatic work two minutes before Manila midnight", () => {
  assert.equal(
    getManilaAutomaticBatchCutoff(new Date("2026-09-03T14:30:00.000Z")),
    "2026-09-03T15:58:00.000Z"
  );
});

test("does not allow automatic work at or after the midnight deadline", () => {
  const deadlineAt = "2026-09-03T16:00:00.000Z";
  assert.equal(
    hasAutomaticBatchDeadlinePassed(deadlineAt, new Date("2026-09-03T15:59:59.999Z")),
    false
  );
  assert.equal(
    hasAutomaticBatchDeadlinePassed(deadlineAt, new Date("2026-09-03T16:00:00.000Z")),
    true
  );
});

test("caps retry-message retention at the midnight deadline", () => {
  assert.equal(
    getAutomaticBatchRetryRetentionSeconds(
      "2026-09-03T16:00:00.000Z",
      new Date("2026-09-03T14:30:00.000Z")
    ),
    90 * 60
  );
});
