import test from "node:test";
import assert from "node:assert/strict";
import { searchCatalogue } from "../src/catalogue.js";
test("searches real metadata, limits fields, and normalizes results", async () => {
  const books = await searchCatalogue("9780735211292", {
    fetcher: async (url) => {
      assert.equal(url.origin, "https://openlibrary.org");
      assert.equal(url.searchParams.get("q"), "isbn:9780735211292");
      assert.equal(url.searchParams.get("limit"), "8");
      return {
        ok: true,
        json: async () => ({
          docs: [
            {
              title: "Atomic Habits",
              author_name: ["James Clear"],
              cover_i: 123,
              key: "/works/OL1W",
              isbn: ["invalid", "9780735211292"],
              subject: ["Self-help"],
            },
          ],
        }),
      };
    },
  });
  assert.equal(books[0].genre, "Nonfiction");
  assert.equal(books[0].isbn, "9780735211292");
  assert.equal(books[0].sourceKey, "/works/OL1W");
});
test("handles errors and malformed service responses", async () => {
  await assert.rejects(searchCatalogue("x"), /two characters/);
  await assert.rejects(
    searchCatalogue("rate-limit-test", {
      fetcher: async () => ({ ok: false, status: 429 }),
    }),
    /busy/,
  );
  await assert.rejects(
    searchCatalogue("invalid-response-test", {
      fetcher: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /invalid response/,
  );
  await assert.rejects(
    searchCatalogue("offline-test", {
      fetcher: async () => {
        throw Error("Network unavailable");
      },
    }),
    /Network/,
  );
});

test("handles incomplete catalogue metadata without breaking the result list", async () => {
  const books = await searchCatalogue("incomplete-metadata-regression", {
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        docs: [
          null,
          { title: "" },
          {
            title: "A title",
            author_name: "Not an array",
            isbn: "invalid",
            subject: "invalid",
            cover_i: -1,
          },
          {
            title: "Another title",
            author_name: [null, "An author"],
            isbn: [123, "9780735211292"],
            subject: [null, "Fantasy"],
          },
        ],
      }),
    }),
  });
  assert.equal(books.length, 2);
  assert.equal(books[0].author, "Unknown author");
  assert.equal(books[0].isbn, "");
  assert.equal(books[0].coverId, null);
  assert.equal(books[1].author, "An author");
  assert.equal(books[1].isbn, "9780735211292");
  assert.equal(books[1].genre, "Fantasy");
});
test("cancelled searches do not fetch or reuse a cached response", async () => {
  const controller = new AbortController();
  controller.abort();
  let requested = false;
  await assert.rejects(
    searchCatalogue("9780735211292", {
      signal: controller.signal,
      fetcher: async () => {
        requested = true;
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(requested, false);
});
