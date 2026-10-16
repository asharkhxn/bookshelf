import {
  genres,
  filterBooks,
  decorateBook,
  validateBook,
  sameBook,
  coverURL,
  validISBN,
} from "./books.js";
import { searchCatalogue } from "./catalogue.js";
import { loadLibrary, saveBook, recommendationURL } from "./library.js";
const $ = (selector) => document.querySelector(selector);
const state = {
  books: [],
  query: "",
  genre: "All",
  detailId: null,
  editable: false,
  revisions: {},
  loading: true,
  failed: false,
};
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const tooltip = $("#book-tooltip");
let toastTimer, detailOrigin, selectedBook, searchController, editingBook;
let entryShelf = "recommended";
let searchGeneration = 0;
let searchTimer;
let lastSearchStarted = 0;
function cancelLookup() {
  clearTimeout(searchTimer);
  searchController?.abort();
  searchGeneration++;
  $("#lookup-results").removeAttribute("aria-busy");
  $("#lookup-form button").disabled = false;
}
function scheduleLookup(immediate = false) {
  cancelLookup();
  const query = $("#lookup").value.trim();
  $("#lookup-results").replaceChildren();
  $("#manual-entry").textContent = "Can’t find it? Enter it manually ↗";
  if (query.length < 2) {
    $("#lookup-status").textContent =
      "Type a title, author, or ISBN to search Open Library.";
    return;
  }
  $("#lookup-status").textContent = "Looking for your book…";
  // Debounce typing and keep requests within the catalogue's public rate limit.
  const delay = Math.max(
    immediate ? 0 : 600,
    1100 - (Date.now() - lastSearchStarted),
  );
  searchTimer = setTimeout(lookup, delay);
}
function resultJacket(book) {
  const jacket = node("span", "result-jacket", "✦");
  paintBook(jacket, decorateBook(book, entryShelf));
  const url = coverURL(book, "M");
  if (url) {
    const image = node("img");
    image.src = url;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    jacket.append(image);
  }
  return jacket;
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}
function paintBook(element, book) {
  element.style.setProperty("--book-color", book.color);
  element.style.setProperty("--book-ink", book.ink);
}
function visibleBooks(status) {
  return filterBooks(
    state.books.filter((book) => book.status === status),
    state.query,
    state.genre,
  );
}
function bookButton(book) {
  const slot = node("div", "book-slot");
  paintBook(slot, book);
  slot.style.setProperty("--w", `${book.width}px`);
  slot.style.setProperty("--h", `${book.height}px`);
  slot.style.setProperty("--lean", `${book.lean}deg`);
  slot.style.setProperty(
    "--title-size",
    `${Math.max(8.5, Math.min(15, book.width * 0.33))}px`,
  );
  const button = node(
    "button",
    `book face-${book.face}${book.width >= 44 ? " wide" : ""}`,
  );
  button.type = "button";
  button.dataset.bookId = book.id;
  button.setAttribute("aria-label", `${book.title} by ${book.author}`);
  const object = node("span", "book-object");
  object.setAttribute("aria-hidden", "true");
  const spine = node("span", "spine");
  const texture = node("img", "spine-cover");
  if (book.cover) texture.src = book.cover.replace("-L.jpg", "-M.jpg");
  texture.alt = "";
  texture.loading = "lazy";
  texture.draggable = false;
  texture.addEventListener("error", () => texture.remove(), { once: true });
  if (book.cover) spine.append(texture);
  const title = node("span", "spine-title");
  title.append(node("span", "", book.title));
  spine.append(title);
  if (book.width >= 44) spine.append(node("span", "spine-author", book.author));
  spine.append(node("span", "spine-mark", "✦"));
  const front = node("span", "book-front");
  front.append(node("strong", "", book.title), node("small", "", book.author));
  const frontCover = node("img", "front-cover");
  if (book.cover) frontCover.src = book.cover.replace("-L.jpg", "-M.jpg");
  frontCover.alt = "";
  frontCover.loading = "lazy";
  frontCover.draggable = false;
  frontCover.addEventListener("error", () => frontCover.remove(), {
    once: true,
  });
  if (book.cover) front.append(frontCover);
  object.append(spine, front, node("span", "book-top"));
  button.append(object);
  button.addEventListener("click", () => {
    if (button.closest(".shelf-viewport").dataset.dragged === "true") return;
    detailOrigin = button;
    openBook(book.id);
  });
  const showTooltip = () => {
    const rect = button.getBoundingClientRect();
    tooltip.replaceChildren(
      node("strong", "", book.title),
      node("span", "", book.author),
      node(
        "small",
        "",
        `${book.genre} · ${book.status === "read" ? "Read" : "Recommended"}`,
      ),
    );
    tooltip.style.left = `${Math.max(134, Math.min(innerWidth - 134, rect.left + rect.width / 2))}px`;
    tooltip.style.top = `${rect.top - 38}px`;
    tooltip.hidden = false;
  };
  button.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch" && !button.closest(".dragging"))
      showTooltip();
  });
  button.addEventListener("focus", showTooltip);
  button.addEventListener("pointerleave", hideTooltip);
  button.addEventListener("blur", hideTooltip);
  slot.append(button);
  return slot;
}
function hideTooltip() {
  tooltip.hidden = true;
}
function emptyShelf(status, filtered) {
  const empty = node("div", "empty-state");
  let title, description;
  if (state.loading) {
    title = "Finding the shelves…";
    description = "";
  } else if (state.failed) {
    title = "The shelves are unavailable.";
    description = "Please try loading the library again.";
  } else if (filtered) {
    title = "No books match just yet.";
    description = "Try another title, author, or genre.";
  } else if (status === "read") {
    title = "A new chapter starts here.";
    description = "The first book is still to come.";
  } else {
    title = "Know a book I’d love?";
    description = "Leave a recommendation for the next chapter.";
  }
  empty.append(node("p", "", title));
  if (description) empty.append(node("p", "empty-detail", description));
  if (!state.loading && !state.failed && !filtered) {
    if (status === "recommended" || state.editable) {
      const button = node(
        "button",
        "pill",
        status === "read" ? "Add the first book ＋" : "Recommend a book ↗",
      );
      button.type = "button";
      button.addEventListener("click", () => openEntry(status));
      empty.append(button);
    }
  }
  return empty;
}
function render() {
  const read = visibleBooks("read"),
    recommended = visibleBooks("recommended");
  const filtered = Boolean(state.query.trim() || state.genre !== "All");
  $("#volume-count").textContent = state.loading
    ? "Loading the shelves…"
    : state.failed
      ? "Library unavailable"
      : `${read.length} ${filtered ? "matching " : ""}${read.length === 1 ? "volume" : "volumes"}`;
  $("#recommended-count").textContent = state.loading
    ? ""
    : state.failed
      ? "Unavailable"
      : `${recommended.length} ${recommended.length === 1 ? "book" : "books"}`;
  $("#clear-search").hidden = !state.query;
  $(".filters").hidden = state.books.length === 0;
  $("#shelf-hint").hidden = !read.length;
  $("#manage-library").hidden = !state.editable;
  for (const [status, books] of [
    ["read", read],
    ["recommended", recommended],
  ]) {
    const track = $(`#${status}-track`);
    track.replaceChildren(...books.map(bookButton));
    if (!books.length) track.append(emptyShelf(status, filtered));
    positionSpines($(`#${status}-shelf`));
  }
  hideTooltip();
}
async function refreshLibrary() {
  state.loading = true;
  state.failed = false;
  $("#library-error").hidden = true;
  render();
  try {
    const result = await loadLibrary({ local: isLocal });
    state.books = [
      ...result.read.map((book) => decorateBook(book, "read")),
      ...result.recommended.map((book) => decorateBook(book, "recommended")),
    ];
    state.editable = result.editable;
    state.revisions = result.revisions || {};
  } catch (error) {
    state.failed = true;
    $("#library-error-text").textContent = error.message;
    $("#library-error").hidden = false;
  } finally {
    state.loading = false;
    render();
  }
}
function errorAt(id, message) {
  $(id).textContent = message;
  $(id).hidden = !message;
}
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5000);
}
function positionSpines(viewport) {
  const rect = viewport.getBoundingClientRect();
  for (const book of viewport.querySelectorAll(".book")) {
    const box = book.getBoundingClientRect();
    const offset = Math.max(
      -1,
      Math.min(
        1,
        (box.left + box.width / 2 - rect.width / 2) / (rect.width / 2),
      ),
    );
    book.style.setProperty(
      "--ry",
      `${Math.sign(offset) * Math.abs(offset) ** 1.35 * 34}deg`,
    );
  }
}
for (const genre of genres) {
  const button = node("button", "pill", genre);
  button.type = "button";
  button.setAttribute("aria-pressed", String(genre === "All"));
  button.addEventListener("click", () => {
    state.genre = genre;
    for (const other of $("#genre-filters").children)
      other.setAttribute("aria-pressed", String(other === button));
    render();
  });
  $("#genre-filters").append(button);
}
$("#shelf-search").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});
$("#clear-search").addEventListener("click", () => {
  state.query = "";
  $("#shelf-search").value = "";
  render();
  $("#shelf-search").focus();
});
for (const viewport of document.querySelectorAll(".shelf-viewport")) {
  let start = null;
  let frame;
  viewport.addEventListener(
    "scroll",
    () => {
      hideTooltip();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => positionSpines(viewport));
    },
    { passive: true },
  );
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (
        viewport.scrollWidth <= viewport.clientWidth ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      const atStart = viewport.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd =
        viewport.scrollLeft + viewport.clientWidth >=
          viewport.scrollWidth - 1 && event.deltaY > 0;
      if (atStart || atEnd) return;
      event.preventDefault();
      viewport.scrollLeft += event.deltaY;
    },
    { passive: false },
  );
  viewport.addEventListener("pointerdown", (event) => {
    viewport.dataset.dragged = "false";
    if (event.pointerType === "touch" || event.button !== 0) return;
    start = { x: event.clientX, left: viewport.scrollLeft };
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > 5) {
      viewport.dataset.dragged = "true";
      viewport.classList.add("dragging");
      hideTooltip();
      viewport.scrollLeft = start.left - (event.clientX - start.x);
    }
  });
  const stopDrag = () => {
    start = null;
    viewport.classList.remove("dragging");
  };
  window.addEventListener("pointerup", stopDrag);
  viewport.addEventListener("pointerleave", stopDrag);
  viewport.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    viewport.scrollBy({
      left: event.key === "ArrowRight" ? 260 : -260,
      behavior: reducedMotion.matches ? "instant" : "smooth",
    });
  });
}
window.addEventListener("resize", () => {
  hideTooltip();
  document.querySelectorAll(".shelf-viewport").forEach(positionSpines);
});

function closeDialog(dialog) {
  dialog.close();
}
function bindDialog(dialog) {
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      closeDialog(dialog);
    if (event.target.closest("[data-close]")) closeDialog(dialog);
  });
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]"))
      document.body.style.overflow = "";
    hideTooltip();
  });
}
function showDialog(dialog) {
  hideTooltip();
  dialog.showModal();
  document.body.style.overflow = "hidden";
}
for (const dialog of document.querySelectorAll("dialog")) bindDialog(dialog);

function openBook(id) {
  const book = state.books.find((book) => book.id === id);
  if (!book) return;
  state.detailId = id;
  const dialog = $("#book-dialog"),
    close = node("button", "close-dialog", "×");
  close.dataset.close = "";
  close.setAttribute("aria-label", "Close book details");
  const layout = node("div", "detail-layout"),
    cover = node("div", "detail-cover");
  paintBook(cover, book);
  const coverType = node("div", "cover-type");
  coverType.append(
    node("strong", "", book.title),
    node("span", "", book.author),
  );
  cover.append(coverType);
  if (book.cover) {
    const image = node("img");
    image.src = book.cover;
    image.alt = `${book.title} book cover`;
    image.addEventListener("error", () => image.remove(), { once: true });
    cover.append(image);
  }
  const info = node("div", "detail-info"),
    title = node("h2", "", book.title);
  title.id = "detail-title";
  info.append(
    node(
      "p",
      "eyebrow",
      book.status === "read" ? "On the finished shelf" : "Recommended to me",
    ),
    title,
    node("p", "detail-author", book.author),
    node("span", "detail-genre", book.genre),
  );
  if (book.status === "recommended")
    info.append(
      node("p", "detail-recommender", `Recommended by ${book.recommendedBy}`),
    );
  if (book.rating) {
    const rating = node(
      "p",
      "detail-rating",
      "★".repeat(book.rating) + "☆".repeat(5 - book.rating),
    );
    rating.setAttribute("aria-label", `${book.rating} out of 5 stars`);
    info.append(rating);
  }
  if (book.status === "recommended" && book.note)
    info.append(node("p", "detail-description", book.note));
  if (book.status === "read" && book.notes)
    info.append(node("p", "detail-description", book.notes));
  if (book.isbn) info.append(node("p", "detail-isbn", `ISBN ${book.isbn}`));
  if (book.sourceKey) {
    const link = node("a", "text-button", "View on Open Library ↗");
    link.href = `https://openlibrary.org${book.sourceKey}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    info.append(link);
  }
  if (state.editable) {
    const edit = node("button", "pill detail-edit", "Edit book");
    edit.addEventListener("click", () => {
      closeDialog(dialog);
      openEditor(book);
    });
    info.append(edit);
  }
  layout.append(cover, info);
  const nav = node("div", "detail-navigation"),
    previous = node("button", "", "← Previous"),
    next = node("button", "", "Next →");
  previous.setAttribute("aria-label", "Previous book");
  next.setAttribute("aria-label", "Next book");
  previous.addEventListener("click", () => stepBook(-1));
  next.addEventListener("click", () => stepBook(1));
  const books = visibleBooks(book.status),
    index = books.findIndex((item) => item.id === book.id);
  previous.disabled = next.disabled = books.length < 2;
  nav.append(
    previous,
    node("span", "", `${index + 1} / ${books.length}`),
    next,
  );
  dialog.replaceChildren(close, layout, nav);
  if (!dialog.open) showDialog(dialog);
}
function stepBook(direction) {
  const book = state.books.find((book) => book.id === state.detailId);
  if (!book) return;
  const books = visibleBooks(book.status),
    index = books.findIndex((item) => item.id === book.id);
  if (books.length)
    openBook(books[(index + direction + books.length) % books.length].id);
}
$("#book-dialog").addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    stepBook(event.key === "ArrowRight" ? 1 : -1);
  }
});
$("#book-dialog").addEventListener("close", () => {
  if (detailOrigin?.isConnected) detailOrigin.focus({ preventScroll: true });
});

for (const selector of ["#entry-genre", "#edit-genre"])
  for (const genre of genres.slice(1)) {
    const option = node("option", "", genre);
    option.value = genre;
    $(selector).append(option);
  }
function showPanel(panel) {
  for (const selector of ["#lookup-panel", "#manual-form", "#entry-form"])
    $(selector).hidden = selector !== panel;
  errorAt("#entry-error", "");
}
function openEntry(shelf = "recommended") {
  if (shelf === "read" && !state.editable) return;
  entryShelf = shelf;
  selectedBook = null;
  cancelLookup();
  $("#lookup-form").reset();
  $("#manual-form").reset();
  $("#entry-form").reset();
  $("#lookup-results").replaceChildren();
  $("#lookup-status").textContent =
    "Type a title, author, or ISBN to search Open Library.";
  $("#manual-entry").textContent = "Can’t find it? Enter it manually ↗";
  $("#lookup-results").removeAttribute("aria-busy");
  $("#lookup-form button").disabled = false;
  $("#entry-title").textContent =
    shelf === "read" ? "Add a finished book." : "Recommend a book.";
  $("#entry-eyebrow").textContent =
    shelf === "read" ? "One for the archive" : "Good books are better shared";
  $("#entry-description").textContent =
    shelf === "read"
      ? "Find the book and add your thoughts."
      : "What should I read next? Leave a little something on my shelf.";
  $("#recommendation-fields").hidden = shelf === "read";
  $("#recommender-name").required = shelf === "recommended";
  $("#reading-fields").hidden = shelf !== "read";
  $("#save-entry").textContent = state.editable
    ? "Save to shelf"
    : "Continue on GitHub ↗";
  $("#entry-destination").textContent = state.editable
    ? "Saved to your project files. Commit and push to publish."
    : "Your recommendation opens a GitHub issue for review. A GitHub account is required; your name and note will be public.";
  showPanel("#lookup-panel");
  showDialog($("#recommend-dialog"));
  $("#lookup").focus();
}
function chooseBook(book) {
  cancelLookup();
  selectedBook = book;
  const selected = $("#recommend-selection"),
    jacket = resultJacket(book),
    meta = node("div");
  meta.append(node("strong", "", book.title), node("small", "", book.author));
  selected.replaceChildren(jacket, meta);
  $("#entry-genre").value = book.genre || "Other";
  showPanel("#entry-form");
  (entryShelf === "recommended"
    ? $("#recommender-name")
    : $("#entry-genre")
  ).focus();
}
async function lookup() {
  clearTimeout(searchTimer);
  const query = $("#lookup").value.trim();
  if (query.length < 2) return;
  lastSearchStarted = Date.now();
  searchController?.abort();
  const controller = new AbortController();
  searchController = controller;
  const generation = ++searchGeneration;
  $("#lookup-status").textContent = "Searching Open Library…";
  $("#lookup-results").replaceChildren();
  $("#lookup-results").setAttribute("aria-busy", "true");
  $("#lookup-form button").disabled = true;
  try {
    const books = await searchCatalogue(query, { signal: controller.signal });
    if (generation !== searchGeneration) return;
    $("#lookup-status").textContent = books.length
      ? "Choose the right book or edition."
      : "No books found. Try another search or enter it manually.";
    $("#manual-entry").textContent = books.length
      ? "None of these? Enter the book manually ↗"
      : "Add this book manually ↗";
    $("#lookup-results").replaceChildren(
      ...books.map((book) => {
        const row = node("div", "result"),
          jacket = resultJacket(book);
        const meta = node("div", "result-meta");
        meta.append(
          node("strong", "", book.title),
          node("small", "", book.author),
        );
        const exists = state.books.some(
          (item) => item.status === entryShelf && sameBook(item, book),
        );
        const pick = node("button", "", exists ? "On the shelf" : "Pick →");
        pick.type = "button";
        pick.disabled = exists;
        pick.setAttribute(
          "aria-label",
          exists
            ? `${book.title} is already on this shelf`
            : `Select ${book.title}`,
        );
        pick.addEventListener("click", () => chooseBook(book));
        row.append(jacket, meta, pick);
        return row;
      }),
    );
  } catch (error) {
    if (generation !== searchGeneration || controller.signal.aborted) return;
    $("#manual-entry").textContent = "Enter the book manually ↗";
    $("#lookup-status").textContent =
      error.name === "TimeoutError"
        ? "Search took too long. Try again or enter the book manually."
        : navigator.onLine === false
          ? "You’re offline. Enter the book manually or reconnect to search."
          : error.message;
  } finally {
    if (generation === searchGeneration) {
      $("#lookup-results").removeAttribute("aria-busy");
      $("#lookup-form button").disabled = false;
    }
  }
}
$("#lookup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  scheduleLookup(true);
});
$("#lookup").addEventListener("input", (event) => {
  if (event.isComposing) {
    cancelLookup();
    return;
  }
  scheduleLookup();
});
$("#lookup").addEventListener("compositionend", () => scheduleLookup());
$("#manual-entry").addEventListener("click", () => {
  cancelLookup();
  const query = $("#lookup").value.trim();
  if (validISBN(query)) {
    if (!$("#manual-isbn").value) $("#manual-isbn").value = query;
  } else if (!$("#manual-title").value) $("#manual-title").value = query;
  showPanel("#manual-form");
  $("#manual-title").focus();
});
$("#back-to-search").addEventListener("click", () => {
  showPanel("#lookup-panel");
  scheduleLookup(true);
  $("#lookup").focus();
});
$("#manual-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const book = validateBook(
      {
        id: crypto.randomUUID(),
        title: $("#manual-title").value,
        author: $("#manual-author").value,
        isbn: $("#manual-isbn").value,
        genre: "Other",
      },
      "read",
    );
    chooseBook(book);
  } catch (error) {
    errorAt("#entry-error", error.message);
  }
});
$("#choose-another").addEventListener("click", () => {
  selectedBook = null;
  showPanel("#lookup-panel");
  $("#lookup").focus();
});
$("#recommend-book").addEventListener("click", () => openEntry());
$("#recommend-dialog").addEventListener("close", () => {
  // A queued close event can arrive after the same dialog has been reopened.
  if (!$("#recommend-dialog").open) cancelLookup();
});
async function persist(operation, shelf, book) {
  const result = await saveBook(operation, shelf, book, state.revisions[shelf]);
  state.books = [
    ...state.books.filter((item) => item.status !== shelf),
    ...result.books.map((item) => decorateBook(item, shelf)),
  ];
  state.revisions[shelf] = result.revision;
  render();
}
$("#entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedBook) return;
  try {
    const book = validateBook(
      {
        ...selectedBook,
        id: crypto.randomUUID(),
        genre: $("#entry-genre").value,
        recommendedBy: $("#recommender-name").value,
        note: $("#recommend-note").value,
        notes: $("#entry-notes").value,
        rating: entryShelf === "read" ? $("#entry-rating").value : 0,
      },
      entryShelf,
    );
    if (
      state.books.some(
        (item) => item.status === entryShelf && sameBook(item, book),
      )
    )
      throw Error("This book is already on the shelf.");
    if (!state.editable) {
      location.assign(recommendationURL(book));
      return;
    }
    $("#save-entry").disabled = true;
    errorAt("#entry-error", "");
    await persist("upsert", entryShelf, book);
    closeDialog($("#recommend-dialog"));
    clearFilters();
    document.querySelector(`[data-book-id="${book.id}"]`)?.scrollIntoView({
      behavior: reducedMotion.matches ? "instant" : "smooth",
      block: "center",
      inline: "center",
    });
    toast("Book saved to your project files. Commit and push to publish.");
  } catch (error) {
    errorAt("#entry-error", error.message);
  } finally {
    $("#save-entry").disabled = false;
  }
});
function clearFilters() {
  state.query = "";
  state.genre = "All";
  $("#shelf-search").value = "";
  for (const button of $("#genre-filters").children)
    button.setAttribute("aria-pressed", String(button.textContent === "All"));
  render();
}
$("#manage-library").addEventListener("click", () =>
  showDialog($("#manage-dialog")),
);
$("#add-finished").addEventListener("click", () => {
  closeDialog($("#manage-dialog"));
  openEntry("read");
});
$("#add-recommended").addEventListener("click", () => {
  closeDialog($("#manage-dialog"));
  openEntry("recommended");
});
function openEditor(book) {
  if (!state.editable) return;
  editingBook = book;
  for (const [selector, value] of [
    ["#edit-book-title", book.title],
    ["#edit-author", book.author],
    ["#edit-isbn", book.isbn],
    ["#edit-genre", book.genre],
    ["#edit-rating", book.rating],
    ["#edit-notes", book.notes],
    ["#edit-recommender", book.recommendedBy],
    ["#edit-note", book.note],
  ])
    $(selector).value = value;
  $("#edit-reading").hidden = book.status !== "read";
  $("#edit-recommendation").hidden = book.status !== "recommended";
  $("#edit-recommender").required = book.status === "recommended";
  errorAt("#edit-error", "");
  showDialog($("#edit-dialog"));
  $("#edit-book-title").focus();
}
$("#edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingBook || !state.editable) return;
  try {
    const book = validateBook(
      {
        ...editingBook,
        title: $("#edit-book-title").value,
        author: $("#edit-author").value,
        isbn: $("#edit-isbn").value,
        genre: $("#edit-genre").value,
        rating: $("#edit-rating").value,
        notes: $("#edit-notes").value,
        recommendedBy: $("#edit-recommender").value,
        note: $("#edit-note").value,
      },
      editingBook.status,
    );
    $("#save-edit").disabled = $("#delete-book").disabled = true;
    errorAt("#edit-error", "");
    await persist("upsert", editingBook.status, book);
    closeDialog($("#edit-dialog"));
    toast("Book updated. Commit and push to publish.");
  } catch (error) {
    errorAt("#edit-error", error.message);
  } finally {
    $("#save-edit").disabled = $("#delete-book").disabled = false;
  }
});
$("#delete-book").addEventListener("click", async () => {
  if (
    !editingBook ||
    !state.editable ||
    !confirm(
      `Remove “${editingBook.title}” from the shelf? This saves the removal to your project files.`,
    )
  )
    return;
  try {
    $("#save-edit").disabled = $("#delete-book").disabled = true;
    await persist("delete", editingBook.status, editingBook);
    closeDialog($("#edit-dialog"));
    toast("Book removed. Commit and push to publish.");
  } catch (error) {
    errorAt("#edit-error", error.message);
  } finally {
    $("#save-edit").disabled = $("#delete-book").disabled = false;
  }
});
$("#retry-library").addEventListener("click", refreshLibrary);
refreshLibrary();
