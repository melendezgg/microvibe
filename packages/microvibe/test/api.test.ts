import test from "node:test";
import assert from "node:assert/strict";
import { getAllowedMethods, selectApiHandler } from "../src/api";

test("getAllowedMethods returns exported HTTP methods only", () => {
  const allow = getAllowedMethods({
    GET: () => null,
    PATCH: () => null,
    default: () => null,
  });
  assert.deepEqual(allow, ["GET", "PATCH"]);
});

test("selectApiHandler prefers method-specific handler", () => {
  const byMethod = () => "by-method";
  const fallback = () => "default";
  const selected = selectApiHandler(
    {
      GET: byMethod,
      default: fallback,
    },
    "GET"
  );
  assert.equal(selected.handler, byMethod);
  assert.deepEqual(selected.allow, ["GET"]);
});

test("selectApiHandler falls back to default handler", () => {
  const fallback = () => "default";
  const selected = selectApiHandler(
    {
      POST: () => null,
      default: fallback,
    },
    "GET"
  );
  assert.equal(selected.handler, fallback);
  assert.deepEqual(selected.allow, ["POST"]);
});

test("selectApiHandler returns allow list when method is not implemented", () => {
  const selected = selectApiHandler(
    {
      GET: () => null,
      POST: () => null,
    },
    "PATCH"
  );
  assert.equal(selected.handler, undefined);
  assert.deepEqual(selected.allow, ["GET", "POST"]);
});
