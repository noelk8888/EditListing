import test from "node:test";
import assert from "node:assert/strict";
import { resolveSaleOrLease } from "../lib/listing-sale-or-lease.ts";

test("recognizes a dated LEASED OUT heading as a lease listing", () => {
  assert.equal(resolveSaleOrLease({
    text: "*LEASED OUT - AUGUST 2026*\nLease Rate: P70,000/month",
    status: "LEASED OUT",
    leasePrice: 70000,
  }), "Lease");
});
test("preserves an explicitly saved transaction type", () => {
  assert.equal(resolveSaleOrLease({
    savedValue: "Lease",
    text: "*LEASED OUT - AUGUST 2026*",
  }), "Lease");
});

test("uses an unambiguous lease price when the heading is missing", () => {
  assert.equal(resolveSaleOrLease({ leasePrice: "70000" }), "Lease");
});

test("does not infer Sale merely from a SOLD status", () => {
  assert.equal(resolveSaleOrLease({ status: "SOLD" }), null);
});
