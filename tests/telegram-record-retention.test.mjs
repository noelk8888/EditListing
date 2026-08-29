import test from "node:test";
import assert from "node:assert/strict";
import {
  TELEGRAM_RECORD_RETENTION_MS,
  shouldPurgeTelegramSetting,
} from "../lib/telegram-record-retention.ts";

const now = Date.parse("2026-08-29T12:00:00.000Z");

test("purges a Telegram forward record after two days", () => {
  assert.equal(shouldPurgeTelegramSetting({
    key: "telegram-forward:-100:1",
    value: { forwarded_at: new Date(now - TELEGRAM_RECORD_RETENTION_MS).toISOString() },
    now,
  }), true);
});

test("retains a Telegram record younger than two days", () => {
  assert.equal(shouldPurgeTelegramSetting({
    key: "telegram-forward:-100:2",
    value: { forwarded_at: new Date(now - TELEGRAM_RECORD_RETENTION_MS + 1).toISOString() },
    now,
  }), false);
});

test("purges retired Auto Lite records under the same retention policy", () => {
  assert.equal(shouldPurgeTelegramSetting({
    key: "telegram-lite-pending:-100:3",
    value: { created_at: "2026-08-20T00:00:00.000Z" },
    now,
  }), true);
});

test("recent activity extends retention", () => {
  assert.equal(shouldPurgeTelegramSetting({
    key: "telegram-forward:-100:4",
    value: {
      forwarded_at: "2026-08-20T00:00:00.000Z",
      deletion_requested_at: "2026-08-29T11:00:00.000Z",
    },
    now,
  }), false);
});

test("never purges permanent app settings", () => {
  for (const key of ["telegram-batch-capture", "telegram-batch-run-lock", "backup_config"]) {
    assert.equal(shouldPurgeTelegramSetting({
      key,
      value: { updated_at: "2020-01-01T00:00:00.000Z" },
      updatedAt: "2020-01-01T00:00:00.000Z",
      now,
    }), false);
  }
});

test("retains malformed records instead of deleting blindly", () => {
  assert.equal(shouldPurgeTelegramSetting({
    key: "telegram-forward:-100:5",
    value: {},
    now,
  }), false);
});
