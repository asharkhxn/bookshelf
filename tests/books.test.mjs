import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBook,
  validateCollection,
  validateLibrary,
  sameBook,
  validISBN,
  decorateBook,
} from "../src/books.js";
import { recommendationURL } from "../src/library.js";
const book = {
  id: "book-1",
  title: "A book",
  author: "An author",
  genre: "Fiction",
  isbn: "9780735211292",
};
test("validates real ISBN checksums and rejects incomplete or incorrect values", () => {
  for (const isbn of ["9780735211292", "0-306-40615-2", "080442957X"])
    assert.equal(validISBN(isbn), true);
  for (const isbn of ["9780735211293", "123", "abcdefghij"])
    assert.equal(validISBN(isbn), false);
  assert.throws(
    () => validateBook({ ...book, isbn: "123" }, "read"),
    /valid.*ISBN/,
  );
});
test("rejects invalid records and validates recommendation attribution", () => {
  for (const value of [
    null,
    [],
    { ...book, title: " " },
    { ...book, author: "a".repeat(161) },
    { ...book, id: "../../config" },
    { ...book, coverId: -1 },
    { ...book, rating: 6 },
  ])
    assert.throws(() => validateBook(value, "read"));
  assert.throws(() => validateBook(book, "recommended"), /name is required/);
  const result = validateBook(
    {
      ...book,
      recommendedBy: " Alex ",
      note: " A good read ",
      secret: "do not retain",
    },
    "recommended",
  );
  assert.equal(result.recommendedBy, "Alex");
  assert.equal(result.note, "A good read");
  assert.equal(Object.hasOwn(result, "secret"), false);
});
test("does not accept duplicate IDs, editions, or equivalent title and author", () => {
  assert.equal(
    sameBook(book, {
      ...book,
      isbn: "",
      title: " A BOOK ",
      author: "AN AUTHOR",
    }),
    true,
  );
  assert.throws(
    () => validateCollection([book, { ...book, id: "different" }], "read"),
    /Duplicate/,
  );
  assert.throws(() => validateCollection({}, "read"), /array/);
  assert.deepEqual(validateCollection([], "recommended"), []);
});
test("missing covers have a clean fallback; rendering style is stable", () => {
  const value = validateBook({ ...book, isbn: "" }, "read"),
    a = decorateBook(value, "read"),
    b = decorateBook(value, "read");
  assert.equal(a.cover, "");
  assert.equal(a.color, b.color);
  assert.ok(a.width >= 28 && a.height >= 205);
});
test("recommendations open the intended repository and preserve user text as query data", () => {
  const url = new URL(
    recommendationURL({
      ...book,
      title: "Book & another? #1",
      recommendedBy: "Alex",
      note: "A note\nwith a second line.",
    }),
  );
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/asharkhxn/bookshelf/issues/new");
  assert.equal(
    url.searchParams.get("title"),
    "Book recommendation: Book & another? #1",
  );
  assert.ok(
    url.searchParams.get("body").includes("A note\nwith a second line."),
  );
});

test("rejects shared IDs across shelves and preserves an empty starting library", () => {
  assert.deepEqual(validateLibrary([], []), { read: [], recommended: [] });
  assert.throws(
    () => validateLibrary([book], [{ ...book, recommendedBy: "Alex" }]),
    /unique across/,
  );
});
