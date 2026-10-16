import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import { createAppServer } from "../scripts/serve.mjs";
const book = {
  id: "book-1",
  title: "A real book",
  author: "A reader",
  genre: "Fiction",
};
async function fixture(t, editable = true) {
  const root = await mkdtemp(join(tmpdir(), "bookshelf-test-"));
  await mkdir(join(root, "data"));
  for (const file of ["library", "recommendations"])
    await writeFile(join(root, "data", `${file}.json`), "[]\n");
  const server = createAppServer({ root, editable });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  return {
    root,
    base,
    get: async () => fetch(base + "/api/library").then((r) => r.json()),
    post: async (body) =>
      fetch(base + "/api/library", {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}
test("persists additions, detects stale writes and duplicates, edits and removes without touching the other shelf", async (t) => {
  const f = await fixture(t);
  let data = await f.get();
  let r = await f.post({
    operation: "upsert",
    shelf: "read",
    book,
    revision: data.revisions.read,
  });
  assert.equal(r.status, 200);
  const added = await r.json();
  assert.equal(
    JSON.parse(await readFile(join(f.root, "data/library.json"), "utf8"))[0]
      .title,
    book.title,
  );
  r = await f.post({
    operation: "upsert",
    shelf: "read",
    book: { ...book, title: "Overwritten" },
    revision: data.revisions.read,
  });
  assert.equal(r.status, 409);
  r = await f.post({
    operation: "upsert",
    shelf: "read",
    book: { ...book, id: "duplicate" },
    revision: added.revision,
  });
  assert.equal(r.status, 409);
  r = await f.post({
    operation: "upsert",
    shelf: "read",
    book: { ...book, notes: "My published notes" },
    revision: added.revision,
  });
  assert.equal(r.status, 200);
  const edited = await r.json();
  assert.equal(edited.books[0].notes, "My published notes");
  r = await f.post({
    operation: "delete",
    shelf: "read",
    book,
    revision: edited.revision,
  });
  assert.equal(r.status, 200);
  data = await f.get();
  assert.deepEqual(data.read, []);
  assert.deepEqual(data.recommended, []);
});
test("rejects cross-origin writes, non-JSON requests, unexpected hosts and private file paths", async (t) => {
  const f = await fixture(t);
  let r = await fetch(f.base + "/api/library", {
    method: "POST",
    headers: {
      Origin: "https://malicious.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
  r = await fetch(f.base + "/api/library", {
    method: "POST",
    headers: { Origin: f.base, "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(r.status, 403);
  const hostStatus = await new Promise((resolve, reject) => {
    const requestWithHost = request(
      f.base + "/api/library",
      { headers: { Host: "attacker.example" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    requestWithHost.on("error", reject);
    requestWithHost.end();
  });
  assert.equal(hostStatus, 403);
  for (const path of [
    "/.git/config",
    "/package.json",
    "/src/../../package.json",
    "/data/secrets.json",
  ])
    assert.equal((await fetch(f.base + path)).status, 404);
});
test("read-only preview rejects mutations and bad data cannot silently reset a shelf", async (t) => {
  const f = await fixture(t, false);
  const data = await f.get();
  assert.equal(data.editable, false);
  const r = await f.post({
    operation: "upsert",
    shelf: "read",
    book,
    revision: data.revisions.read,
  });
  assert.equal(r.status, 403);
  await writeFile(join(f.root, "data/library.json"), "not json");
  assert.equal((await fetch(f.base + "/api/library")).status, 500);
  assert.equal(
    await readFile(join(f.root, "data/library.json"), "utf8"),
    "not json",
  );
});
test("queues competing saves so only one stale revision can win", async (t) => {
  const f = await fixture(t);
  const data = await f.get();
  const results = await Promise.all([
    f.post({
      operation: "upsert",
      shelf: "read",
      book,
      revision: data.revisions.read,
    }),
    f.post({
      operation: "upsert",
      shelf: "read",
      book: { ...book, id: "book-2", title: "Another book" },
      revision: data.revisions.read,
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await f.get()).read.length, 1);
});
