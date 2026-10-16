import { validISBN, guessGenre } from "./books.js";
const cache = new Map();
export async function searchCatalogue(query, { signal, fetcher = fetch } = {}) {
  signal?.throwIfAborted();
  const term = query.trim();
  if (term.length < 2) throw Error("Enter at least two characters.");
  const cached = cache.get(term.toLowerCase());
  if (cached && Date.now() - cached.time < 600000) return cached.books;
  const url = new URL("https://openlibrary.org/search.json");
  url.search = new URLSearchParams({
    q: validISBN(term)
      ? `isbn:${term.replace(/[\s-]/g, "").toUpperCase()}`
      : term,
    limit: "8",
    fields: "key,title,author_name,cover_i,isbn,subject",
  });
  const response = await fetcher(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw Error(
      response.status === 429
        ? "Book search is busy. Wait a moment and try again."
        : "Book search is unavailable. Try again or enter the book manually.",
    );
  const result = await response.json();
  signal?.throwIfAborted();
  if (!Array.isArray(result.docs))
    throw Error("Book search returned an invalid response. Try manual entry.");
  const books = result.docs
    .filter(
      (book) => book && typeof book.title === "string" && book.title.trim(),
    )
    .map((book) => ({
      title: book.title.slice(0, 200),
      author: (Array.isArray(book.author_name)
        ? book.author_name
            .filter((name) => typeof name === "string" && name.trim())
            .join(", ") || "Unknown author"
        : "Unknown author"
      ).slice(0, 160),
      isbn: Array.isArray(book.isbn)
        ? book.isbn.find(
            (isbn) => typeof isbn === "string" && validISBN(isbn),
          ) || ""
        : "",
      coverId:
        Number.isSafeInteger(book.cover_i) && book.cover_i > 0
          ? book.cover_i
          : null,
      sourceKey: /^\/works\/OL\d+W$/.test(book.key) ? book.key : "",
      genre: guessGenre(
        Array.isArray(book.subject)
          ? book.subject.filter((subject) => typeof subject === "string")
          : [],
      ),
    }));
  if (cache.size >= 40) cache.delete(cache.keys().next().value);
  cache.set(term.toLowerCase(), { time: Date.now(), books });
  return books;
}
