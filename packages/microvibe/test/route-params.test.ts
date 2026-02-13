import test from "node:test";
import assert from "node:assert/strict";
import { validateRouteParams } from "../src/route-params";

test("accepts valid params for regexp rules", () => {
  const check = validateRouteParams(
    { id: "42" },
    {
      id: /^\d+$/,
    }
  );
  assert.deepEqual(check, { ok: true });
});

test("returns 400 when a param rule fails", () => {
  const check = validateRouteParams(
    { id: "abc" },
    {
      id: /^\d+$/,
    }
  );
  assert.equal(check.ok, false);
  if (check.ok) return;
  assert.equal(check.status, 400);
  assert.equal(check.error, "Invalid route param: id");
});

test("skips missing params so optional catch-all can validate when present", () => {
  const check = validateRouteParams(
    {},
    {
      slug: /^[a-z0-9/-]+$/,
    }
  );
  assert.deepEqual(check, { ok: true });
});

test("supports validator result with explicit 404", () => {
  const check = validateRouteParams({}, undefined, () => ({
    ok: false,
    status: 404,
    error: "Record not found",
  }));
  assert.equal(check.ok, false);
  if (check.ok) return;
  assert.equal(check.status, 404);
  assert.equal(check.error, "Record not found");
});
