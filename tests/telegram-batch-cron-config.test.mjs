import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url), "utf8")
);

test("schedules Batch Lite during the 10 PM Manila hour", () => {
  const cron = config.crons.find(
    (entry) => entry.path === "/api/cron/run-telegram-batch-update"
  );
  assert.equal(cron?.schedule, "0 14 * * *");
});

test("registers retry and row consumers with the full Hobby duration", () => {
  const expectations = [
    ["app/api/queues/start-telegram-batch-update/route.ts", "telegram-batch-update-start"],
    ["app/api/queues/run-telegram-batch-update/route.ts", "telegram-batch-update-row"],
    ["app/api/queues/send-telegram-batch-summary/route.ts", "telegram-batch-update-summary"],
  ];

  for (const [route, topic] of expectations) {
    const functionConfig = config.functions[route];
    assert.equal(functionConfig?.maxDuration, 60);
    assert.equal(functionConfig?.experimentalTriggers?.[0]?.topic, topic);
  }
});
