# Ashar’s Bookshelf

A static personal library with finished books and reader recommendations. Hosted on GitHub Pages. Books are stored in the repository, with no database, account service, or runtime dependencies.

Requires Node.js 20 or later. No installation step is needed.

```sh
npm run dev
```

Open http://127.0.0.1:5173. Choose **Manage library** in the footer to add books. Start typing a title, author, or ISBN to search Open Library automatically. Choose a matching book with its cover and metadata. If nothing matches or the service is unavailable, use manual entry; your search text is carried over. The same lookup is used for visitor recommendations. Click an existing book, then **Edit book**, to update its metadata, rating, or notes, or remove it.

## Where books are stored

- `data/library.json`: finished books and your published thoughts/ratings.
- `data/recommendations.json`: reviewed recommendations, including the recommender’s name and optional note.

Both files start empty. The local editor validates changes and saves them atomically to these files. It detects conflicting file changes rather than overwriting them. All data in these files is public when deployed, including notes and names. Keep private notes elsewhere.

To publish your changes:

```sh
git add data/library.json data/recommendations.json
git commit -m "feat: update bookshelf"
git push origin main
```

The GitHub Pages workflow deploys the update automatically. The local editor is available only on the development server and is excluded from public editing; the hosted site has no write API.

## Visitor recommendations

The **Recommend a book** flow searches Open Library and collects a name and optional note. **Continue on GitHub** opens a prefilled issue in this repository; the visitor reviews and submits it using their GitHub account. Nothing is reported as saved or sent before they submit on GitHub.

Review recommendations in the repository’s Issues tab. Add accepted books through **Manage library → Add a recommendation**, then commit and push. The public recommendation shelf shows only the books in `data/recommendations.json`. This review step avoids anonymous writes or spam appearing directly on your site. There is no backend or automatic submission service to maintain.

## Development and checks

```sh
npm run check
npm test
npm run build
npm run preview
```

The build validates the book files and copies the static site to `dist/`. Preview serves the build without allowing edits. Tests cover metadata validation, lookup failures, recommendation links, file persistence, duplicate/conflict handling, and the editor’s origin/host restrictions.

Book lookup uses [Open Library’s Search API](https://openlibrary.org/dev/docs/api/search), cover images use Open Library, and typography loads from Google Fonts with system fallbacks. Lookup errors and unavailable covers have fallbacks; manual entry works without the lookup service.

## GitHub Pages

In [Settings → Pages](https://github.com/asharkhxn/bookshelf/settings/pages), set **Source** to **GitHub Actions**. Push to `main` or manually run **Deploy bookshelf to GitHub Pages** in Actions.

Site URL: https://asharkhxn.github.io/bookshelf/.

If you fork this repository, change `src/config.js` to your repository so recommendation links go to your Issues tab, and enable Issues. Relative assets support project subpaths.
