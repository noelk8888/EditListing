import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDeterministicPrices,
  optimizeExistingListingParse,
} from "../lib/existing-listing-optimizer.ts";

const existing = `G03681
*FOR SALE*
16 Hereford St., Congressional Village, Quezon City
Preselling 3 Storey Townhouse
4 bedrooms
2 car garage
Price: P22,000,000
Photos: https://photos.app.goo.gl/example`;

test("uses zero AI tokens for an explicit status-only update", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("G03681\n*FOR SALE*", "*SOLD - AUGUST 2026*"),
    explicitStatus: "SOLD",
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.reason, "status-only");
  assert.deepEqual(decision.patch, { salePrice: "22000000", status: "SOLD" });
});

test("preserves Lease when FOR LEASE becomes LEASED OUT", () => {
  const leaseListing = existing
    .replace("*FOR SALE*", "*FOR LEASE*")
    .replace("Price: P22,000,000", "Lease Rate: P70,000/month");
  const decision = optimizeExistingListingParse({
    existingSummary: leaseListing,
    text: leaseListing.replace("G03681\n*FOR LEASE*", "*LEASED OUT - AUGUST 2026*"),
    explicitStatus: "LEASED OUT",
  });

  assert.equal(decision.mode, "deterministic");
  assert.deepEqual(decision.patch, {
    leasePrice: "70000",
    status: "LEASED OUT",
    saleOrLease: "Lease",
  });
});

test("uses zero AI tokens when the meaningful listing is unchanged", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("G03681\n", ""),
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.reason, "unchanged");
  assert.equal(decision.patch.salePrice, "22000000");
});

test("applies an unambiguous labeled field change without AI", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("4 bedrooms", "5 bedrooms"),
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.reason, "safe-labeled-fields");
  assert.equal(decision.patch.bedrooms, "5");
});

test("applies a clearly labeled price change without AI", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("P22,000,000", "P23,000,000"),
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.patch.salePrice, "23000000");
});

test("backfills total and per-sqm sale prices without AI", () => {
  const listing = existing.replace(
    "Price: P22,000,000",
    "Price: P95,000,000 (P217,890/sqm) gross",
  );
  const decision = optimizeExistingListingParse({
    existingSummary: listing,
    text: listing,
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.patch.salePrice, "95000000");
  assert.equal(decision.patch.salePricePerSqm, "217890");
});

test("extracts labeled prices independently for the AI fallback path", () => {
  const prices = extractDeterministicPrices(
    "Price: P110,000,000 (P234,542/sqm)",
  );

  assert.deepEqual(prices, {
    salePrice: "110000000",
    salePricePerSqm: "234542",
  });
});

test("backfills lease rate and per-sqm lease price without AI", () => {
  const listing = existing
    .replace("*FOR SALE*", "*FOR LEASE*")
    .replace("Price: P22,000,000", "Lease Rate: Php250,000/month (P610/sqm)");
  const decision = optimizeExistingListingParse({
    existingSummary: listing,
    text: listing,
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.patch.leasePrice, "250000");
  assert.equal(decision.patch.leasePricePerSqm, "610");
});

test("does not treat rental income as a lease price", () => {
  const listing = `${existing}\nRental Income: P300,000/month`;
  const decision = optimizeExistingListingParse({
    existingSummary: listing,
    text: listing,
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.patch.salePrice, "22000000");
  assert.equal(decision.patch.leasePrice, undefined);
});

test("falls back to AI for location or descriptive changes", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("16 Hereford St.", "18 Hereford St."),
  });

  assert.equal(decision.mode, "ai");
});

test("falls back to AI instead of silently clearing a field", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("\nPhotos: https://photos.app.goo.gl/example", ""),
  });

  assert.equal(decision.mode, "ai");
});

test("uses the deterministic path for an explicit photo-link replacement", () => {
  const decision = optimizeExistingListingParse({
    existingSummary: existing,
    text: existing.replace("https://photos.app.goo.gl/example", "https://photos.app.goo.gl/replacement"),
  });

  assert.equal(decision.mode, "deterministic");
  assert.equal(decision.patch.photos, "https://photos.app.goo.gl/replacement");
});

test("falls back for a combined bedroom and bathroom phrase", () => {
  const oldText = existing.replace("4 bedrooms", "4 bedrooms with T&B");
  const decision = optimizeExistingListingParse({
    existingSummary: oldText,
    text: oldText.replace("4 bedrooms with T&B", "5 bedrooms with T&B"),
  });

  assert.equal(decision.mode, "ai");
});
