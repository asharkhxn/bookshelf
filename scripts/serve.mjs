import { createServer } from "node:http";
import {
  readFile,
  writeFile,
  rename,
  unlink,
  realpath,
} from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import {
  validateBook,
  validateCollection,
  validateLibrary,
  sameBook,
} from "../src/books.js";
const files = { read: "library.json", recommended: "recommendations.json" };
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};
const revision = (raw) => createHash("sha256").update(raw).digest("hex");
export function createAppServer({ root = resolve("."), editable = true } = {}) {
  root = resolve(root);
  let writes = Promise.resolve();
  const sendJSON = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  async function readShelf(shelf) {
    const raw = await readFile(resolve(root, "data", files[shelf]), "utf8");
    return {
      books: validateCollection(JSON.parse(raw), shelf),
      revision: revision(raw),
    };
  }
  async function update(payload) {
    if (
      !payload ||
      typeof payload !== "object" ||
      !Object.hasOwn(files, payload.shelf) ||
      !["upsert", "delete"].includes(payload.operation)
    )
      return { status: 400, error: "Invalid save request." };
    const current = await readShelf(payload.shelf);
    if (payload.revision !== current.revision)
      return {
        status: 409,
        error:
          "The book file changed. Close this form and reload the page before saving again.",
      };
    const book = validateBook(payload.book, payload.shelf);
    const other = await readShelf(
      payload.shelf === "read" ? "recommended" : "read",
    );
    if (
      payload.operation === "upsert" &&
      other.books.some((item) => item.id === book.id)
    )
      return {
        status: 409,
        error:
          "This book ID is used on the other shelf. Choose a different ID.",
      };
    let books;
    if (payload.operation === "delete") {
      if (!current.books.some((item) => item.id === book.id))
        return { status: 404, error: "This book has already been removed." };
      books = current.books.filter((item) => item.id !== book.id);
    } else {
      if (
        current.books.some(
          (item) => item.id !== book.id && sameBook(item, book),
        )
      )
        return { status: 409, error: "This book is already on the shelf." };
      books = [...current.books.filter((item) => item.id !== book.id), book];
    }
    validateCollection(books, payload.shelf);
    const raw = JSON.stringify(books, null, 2) + "\n";
    const file = resolve(root, "data", files[payload.shelf]),
      temp = `${file}.tmp-${randomUUID()}`;
    try {
      await writeFile(temp, raw, { flag: "wx" });
      await rename(temp, file);
    } finally {
      await unlink(temp).catch(() => {});
    }
    return { status: 200, books, revision: revision(raw) };
  }
  return createServer(async (req, res) => {
    try {
      const host = req.headers.host || "";
      if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) {
        sendJSON(res, 403, { error: "Local connections only." });
        return;
      }
      const url = new URL(req.url, `http://${host}`);
      if (url.pathname === "/api/library") {
        if (req.method === "GET") {
          const [read, recommended] = await Promise.all([
            readShelf("read"),
            readShelf("recommended"),
          ]);
          sendJSON(res, 200, {
            ...validateLibrary(read.books, recommended.books),
            revisions: {
              read: read.revision,
              recommended: recommended.revision,
            },
            editable,
          });
          return;
        }
        if (req.method !== "POST") {
          res.setHeader("Allow", "GET, POST");
          sendJSON(res, 405, { error: "Method not allowed." });
          return;
        }
        if (!editable) {
          sendJSON(res, 403, { error: "This server is read-only." });
          return;
        }
        if (
          req.headers.origin !== `http://${host}` ||
          req.headers["content-type"]?.split(";")[0] !== "application/json"
        ) {
          sendJSON(res, 403, {
            error: "Save requests must come from this local editor.",
          });
          return;
        }
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 32768) {
            sendJSON(res, 413, { error: "Book data is too large." });
            return;
          }
          chunks.push(chunk);
        }
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          sendJSON(res, 400, { error: "Invalid JSON." });
          return;
        }
        const pending = writes.then(() => update(payload));
        writes = pending.catch(() => {});
        let result;
        try {
          result = await pending;
        } catch (error) {
          sendJSON(res, 400, { error: error.message });
          return;
        }
        const { status, ...body } = result;
        sendJSON(res, status, body);
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, HEAD" });
        res.end("Method not allowed");
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const allowed =
        pathname === "/" ||
        pathname === "/index.html" ||
        /^\/src\/[\w-]+\.(js|css|svg)$/.test(pathname) ||
        /^\/data\/(library|recommendations)\.json$/.test(pathname);
      if (!allowed) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const file = await realpath(
        resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`),
      );
      if (!file.startsWith((await realpath(root)) + sep)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      sendJSON(res, 500, {
        error:
          "The library files could not be read. Check that data/library.json and data/recommendations.json contain valid books.",
      });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : ".",
  );
  const server = createAppServer({
    root,
    editable: !process.argv.includes("--read-only"),
  });
  const port = Number(process.env.PORT || 5173);
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Set PORT to use another port.`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(`Local: http://127.0.0.1:${server.address().port}`),
  );
}
