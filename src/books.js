export const genres = [
  "All",
  "Nonfiction",
  "Fiction",
  "Sci-Fi",
  "Mystery & Thriller",
  "Fantasy",
  "Romance",
  "Other",
];
const palette = [
  ["#ddd6bb", "#302b23"],
  ["#283b4a", "#f3ecda"],
  ["#b66c42", "#f3ecda"],
  ["#a7b5a0", "#302b23"],
  ["#48644b", "#f3ecda"],
  ["#aea18c", "#302b23"],
  ["#d6bc76", "#302b23"],
  ["#758c91", "#f3ecda"],
];
function text(value, label, max, required = false) {
  if (typeof value !== "string" && value != null)
    throw Error(`${label} must be text.`);
  const result = (value || "").trim();
  if (required && !result) throw Error(`${label} is required.`);
  if (result.length > max)
    throw Error(`${label} must be ${max} characters or fewer.`);
  return result;
}
export function validISBN(value) {
  const isbn = String(value || "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (/^\d{13}$/.test(isbn))
    return (
      [...isbn].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) %
        10 ===
      0
    );
  if (/^\d{9}[\dX]$/.test(isbn))
    return (
      [...isbn].reduce(
        (sum, n, i) => sum + (n === "X" ? 10 : Number(n)) * (10 - i),
        0,
      ) %
        11 ===
      0
    );
  return false;
}
export function validateBook(value, shelf) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid book record.");
  if (!["read", "recommended"].includes(shelf)) throw Error("Invalid shelf.");
  const id = text(value.id, "Book ID", 80, true);
  if (!/^[\w-]+$/.test(id)) throw Error("Invalid book ID.");
  const isbn = text(value.isbn, "ISBN", 32).replace(/[\s-]/g, "").toUpperCase();
  if (isbn && !validISBN(isbn))
    throw Error("Enter a valid 10 or 13 digit ISBN, or leave it blank.");
  const genre = text(value.genre, "Genre", 40) || "Other";
  if (!genres.slice(1).includes(genre)) throw Error("Choose a listed genre.");
  const coverId =
    value.coverId == null || value.coverId === ""
      ? null
      : Number(value.coverId);
  if (coverId !== null && (!Number.isSafeInteger(coverId) || coverId < 1))
    throw Error("Invalid cover ID.");
  const rating = Number(value.rating || 0);
  if (!Number.isInteger(rating) || rating < 0 || rating > 5)
    throw Error("Rating must be between 0 and 5.");
  return {
    id,
    title: text(value.title, "Title", 200, true),
    author: text(value.author, "Author", 160, true),
    genre,
    isbn,
    coverId,
    sourceKey: /^\/works\/OL\d+W$/.test(value.sourceKey || "")
      ? value.sourceKey
      : "",
    notes: text(value.notes, "Notes", 3000),
    rating,
    recommendedBy:
      shelf === "recommended"
        ? text(value.recommendedBy, "Recommender name", 60, true)
        : "",
    note:
      shelf === "recommended"
        ? text(value.note, "Recommendation note", 500)
        : "",
  };
}
export function sameBook(a, b) {
  const normalized = (value) =>
    value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return Boolean(
    (a.isbn && b.isbn && a.isbn === b.isbn) ||
    (a.sourceKey && a.sourceKey === b.sourceKey) ||
    (normalized(a.title) === normalized(b.title) &&
      normalized(a.author) === normalized(b.author)),
  );
}
export function validateCollection(value, shelf) {
  if (!Array.isArray(value) || value.length > 5000)
    throw Error("A shelf must contain an array of at most 5,000 books.");
  const books = value.map((book) => validateBook(book, shelf));
  const ids = new Set();
  for (let i = 0; i < books.length; i++) {
    if (
      ids.has(books[i].id) ||
      books.slice(0, i).some((book) => sameBook(book, books[i]))
    )
      throw Error(`Duplicate book: ${books[i].title}`);
    ids.add(books[i].id);
  }
  return books;
}
export function validateLibrary(read, recommended) {
  const result = {
    read: validateCollection(read, "read"),
    recommended: validateCollection(recommended, "recommended"),
  };
  const ids = new Set(result.read.map((book) => book.id));
  if (result.recommended.some((book) => ids.has(book.id)))
    throw Error("Book IDs must be unique across both shelves.");
  return result;
}
export function decorateBook(book, status) {
  let hash = 2166136261;
  for (const char of book.title + book.author)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const [color, ink] = palette[hash % palette.length];
  return {
    ...book,
    status,
    color,
    ink,
    width: 28 + (hash % 25),
    height: 205 + ((hash >>> 8) % 46),
    lean: hash % 9 === 0 ? -2 : 0,
    face: ["serif", "sans", "serif", "mono"][hash % 4],
    cover: coverURL(book),
  };
}
export function coverURL(book, size = "L") {
  if (book.coverId)
    return `https://covers.openlibrary.org/b/id/${book.coverId}-${size}.jpg?default=false`;
  if (book.isbn)
    return `https://covers.openlibrary.org/b/isbn/${book.isbn}-${size}.jpg?default=false`;
  return "";
}
export function filterBooks(books, query = "", genre = "All") {
  const term = query.trim().toLocaleLowerCase();
  return books.filter(
    (book) =>
      (genre === "All" || book.genre === genre) &&
      `${book.title} ${book.author} ${book.isbn}`
        .toLocaleLowerCase()
        .includes(term),
  );
}
export function guessGenre(subjects = []) {
  const value = subjects.join(" ").toLocaleLowerCase();
  for (const [pattern, genre] of [
    [/science fiction/, "Sci-Fi"],
    [/fantasy/, "Fantasy"],
    [/mystery|thriller|detective/, "Mystery & Thriller"],
    [/romance|love stories/, "Romance"],
    [
      /nonfiction|non-fiction|biograph|history|self-help|psychology|business/,
      "Nonfiction",
    ],
    [/fiction|novel/, "Fiction"],
  ])
    if (pattern.test(value)) return genre;
  return "Other";
}
