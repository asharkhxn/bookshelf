import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateLibrary } from "../src/books.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const [read, recommended] = await Promise.all(
  ["library", "recommendations"].map(async (file) =>
    JSON.parse(await readFile(`${root}data/${file}.json`, "utf8")),
  ),
);
const books = validateLibrary(read, recommended);
await rm(`${root}dist`, { recursive: true, force: true });
await mkdir(`${root}dist/data`, { recursive: true });
await cp(`${root}index.html`, `${root}dist/index.html`);
await cp(`${root}src`, `${root}dist/src`, { recursive: true });
// Only these two public collections belong in the deployed site.
await writeFile(
  `${root}dist/data/library.json`,
  JSON.stringify(books.read, null, 2) + "\n",
);
await writeFile(
  `${root}dist/data/recommendations.json`,
  JSON.stringify(books.recommended, null, 2) + "\n",
);
console.log("Validated book files and built the static site in dist/");
