import test from "node:test";
import assert from "node:assert/strict";
import { loadLibrary } from "../src/library.js";
test("the published site reads repository JSON and never enables editing", async () => {
  const requested = [];
  const data = await loadLibrary({
    fetcher: async (url) => {
      requested.push(url.pathname);
      return { ok: true, json: async () => [] };
    },
  });
  assert.equal(data.editable, false);
  assert.deepEqual(data.read, []);
  assert.deepEqual(data.recommended, []);
  assert.ok(requested.some((path) => path.endsWith("/data/library.json")));
  assert.ok(
    requested.some((path) => path.endsWith("/data/recommendations.json")),
  );
  assert.equal(
    requested.some((path) => path.includes("/api/")),
    false,
  );
});
test("missing or malformed published files fail visibly instead of reporting an empty library", async () => {
  await assert.rejects(
    loadLibrary({ fetcher: async () => ({ ok: false, status: 404 }) }),
    /could not load/,
  );
  await assert.rejects(
    loadLibrary({
      fetcher: async () => ({
        ok: true,
        json: async () => ({ not: "a shelf" }),
      }),
    }),
    /array/,
  );
});
