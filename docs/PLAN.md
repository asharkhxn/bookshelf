# Bookshelf plan

## Stage 1 — finalize the structure (current)

Match the supplied reference: warm paper background and grain, Cormorant Garamond heading, Space Mono labels, restrained genre pills, and an interactive horizontal shelf of varied book spines.

- Main shelf: example finished books, title/author/ISBN search, genre filters, drag/trackpad/arrow-key browsing.
- Book details: cover, title, author, genre, and previous/next navigation.
- Second shelf: books waiting to be read.
- Add-book preview: search a sample catalogue and move a sample book to the to-read shelf.
- Responsive layouts, keyboard controls, native accessible dialogs, reduced motion.
- Explicit example/preview labels. No accounts, persistent data, or personal reading history yet.

Review the overall layout, two-shelf structure, book details, and add flow before stage 2.

## Stage 2 — make it personal (after structure approval)

1. Live metadata lookup by title, author, or ISBN with Open Library. Show author, cover, and edition before saving; provide manual entry when lookup fails.
2. Choose a reading status: to read, reading, or finished. Keep the main screen visually simple; decide whether currently reading needs its own shelf or a filter.
3. Store the collection permanently. Choose browser-only with JSON backup/import, or authenticated database storage for device sync. Do not imply local browser data syncs.
4. Add editable notes, rating, date finished, and remove-book confirmation.
5. Support JSON export/import before any bulk edits; consider Goodreads CSV import as a separate addition.

Live search reference: https://openlibrary.org/dev/docs/api/search
