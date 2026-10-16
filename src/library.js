import { validateLibrary, validateBook } from "./books.js";
import { repository } from "./config.js";
export async function loadLibrary({ fetcher = fetch, local = false } = {}) {
  if (local) {
    const response = await fetcher(new URL("../api/library", import.meta.url), {
      cache: "no-store",
    });
    if (!response.ok)
      throw Error(
        "The local library could not load. Check the project’s book files and try again.",
      );
    const result = await response.json();
    return {
      ...validateLibrary(result.read, result.recommended),
      revisions: result.revisions,
      editable: result.editable === true,
    };
  }
  const collections = await Promise.all(
    ["library", "recommendations"].map(async (name) => {
      const response = await fetcher(
        new URL(`../data/${name}.json`, import.meta.url),
        { cache: "no-cache" },
      );
      if (!response.ok)
        throw Error("The library could not load. Please try again.");
      return response.json();
    }),
  );
  return {
    ...validateLibrary(collections[0], collections[1]),
    editable: false,
  };
}
export async function saveBook(
  operation,
  shelf,
  book,
  revision,
  { fetcher = fetch } = {},
) {
  const response = await fetcher(new URL("../api/library", import.meta.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, shelf, book, revision }),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      result.error || "The book could not be saved. Please try again.",
    );
  return result;
}
export function recommendationURL(value) {
  const book = validateBook(value, "recommended");
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set("title", `Book recommendation: ${book.title}`);
  const body = [
    `## Book recommendation`,
    `**Title:** ${book.title}`,
    `**Author:** ${book.author}`,
    `**ISBN:** ${book.isbn || "Not provided"}`,
    `**Genre:** ${book.genre}`,
    `**Recommended by:** ${book.recommendedBy}`,
    ``,
    `### Why I recommend it`,
    book.note || "No note provided.",
    ``,
    `---`,
    `Submitted from Ashar’s Bookshelf. Please review before adding to the recommendation shelf.`,
  ].join("\n");
  url.searchParams.set("body", body);
  return url.href;
}
