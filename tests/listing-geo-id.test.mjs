import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureSingleLeadingGeoId,
  stripLeadingGeoIds,
} from "../lib/listing-geo-id.ts";

test("adds the matched GEO ID to ID-less MAIN content", () => {
  assert.equal(
    ensureSingleLeadingGeoId("*FOR SALE*\nA listing", "G12090"),
    "G12090\n*FOR SALE*\nA listing",
  );
});

test("keeps exactly one copy when the same GEO ID is already present", () => {
  assert.equal(
    ensureSingleLeadingGeoId("G12090\nG12090\n*FOR SALE*", "G12090"),
    "G12090\n*FOR SALE*",
  );
});

test("replaces multiple stale leading GEO IDs with the matched GEO ID", () => {
  assert.equal(
    ensureSingleLeadingGeoId("B12090\n\nG12090\n*FOR SALE*", "G12090"),
    "G12090\n*FOR SALE*",
  );
});

test("normalizes duplicate suffix and dash casing", () => {
  assert.equal(
    ensureSingleLeadingGeoId("g12090-d\n*FOR SALE*", "g12090—d"),
    "G12090-D\n*FOR SALE*",
  );
});

test("does not remove a GEO ID mentioned inside the listing body", () => {
  assert.equal(
    stripLeadingGeoIds("*FOR SALE*\nRelated listing G12090\nG54321"),
    "*FOR SALE*\nRelated listing G12090\nG54321",
  );
});
