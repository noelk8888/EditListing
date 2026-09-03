import test from "node:test";
import assert from "node:assert/strict";
import { formatAutomaticBatchSummary } from "../lib/telegram-batch-summary.ts";

test("formats a successful automatic Batch Lite summary in Manila time", () => {
  assert.equal(
    formatAutomaticBatchSummary({
      processed: 7,
      updated: 7,
      manualChecking: 0,
      completedAt: "2026-09-02T15:59:00.000Z",
    }),
    "7 listings were automatically processed at 11:59pm September 2, 2026."
  );
});

test("uses singular grammar and reports rows requiring manual checking", () => {
  assert.equal(
    formatAutomaticBatchSummary({
      processed: 1,
      updated: 0,
      manualChecking: 1,
      completedAt: "2026-09-02T14:05:00.000Z",
    }),
    "1 listing was automatically processed at 10:05pm September 2, 2026.\n" +
      "0 listings updated; 1 listing marked FOR MANUAL CHECKING."
  );
});
