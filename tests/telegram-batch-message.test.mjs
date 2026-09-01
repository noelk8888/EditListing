import test from "node:test";
import assert from "node:assert/strict";
import {
  extractTelegramSearchCriteria,
  getTelegramUpdateStatus,
  isTelegramUpdateMessage,
  prepareTelegramListingForUpdate,
} from "../lib/telegram-batch-message.ts";

test("recognizes supported Telegram update statuses", () => {
  assert.equal(getTelegramUpdateStatus("*LISTING UPDATE*\nOFF THE MARKET"), "OFF THE MARKET");
  assert.equal(getTelegramUpdateStatus("Listing update\nUNDER NEGOTIATION"), "UNDER NEGO");
  assert.equal(getTelegramUpdateStatus("UPDATED FORMAT"), "");
});

test("accepts updated-format notices without an explicit status", () => {
  assert.equal(isTelegramUpdateMessage("*UPDATED FORMAT*\nBroker Name"), true);
  assert.equal(isTelegramUpdateMessage("unrelated note"), false);
});

test("replaces the listing status using Manila month and year", () => {
  const prepared = prepareTelegramListingForUpdate(
    "*FOR SALE*\nSample Address\nPhotos: https://photos.app.goo.gl/example",
    "SOLD",
    new Date("2026-09-01T00:00:00+08:00")
  );
  assert.match(prepared, /^\*SOLD - SEPTEMBER 2026\*/);
  assert.doesNotMatch(prepared, /FOR SALE/);
});

test("extracts the same search inputs used by LITE mode", () => {
  const criteria = extractTelegramSearchCriteria(
    "G01234\n*FOR SALE*\nSample Address\nPhotos: https://photos.app.goo.gl/example"
  );
  assert.equal(criteria.listingId, "G01234");
  assert.equal(criteria.photoLink, "https://photos.app.goo.gl/example");
  assert.match(criteria.previewText, /Sample Address/);
});

