# Ashar’s Bookshelf

A personal library design prototype inspired by [Carol’s Library](https://carollia-library.lovable.app/). Built with HTML, CSS, and JavaScript; no dependencies or installation needed. Requires Node.js 20+.

```sh
npm run dev
```

Open http://127.0.0.1:5173. `npm run check` checks JavaScript syntax; `npm run build` produces the static `dist/` directory; `npm run preview` serves that build.

The prototype includes 48 example books, search and genre filters, horizontal shelves, book details, and a sample add-book flow. Changes exist only in memory and reset on refresh. No account, permanent storage, or live book search is connected. Cover images load from Open Library; typography loads from Google Fonts, with local font fallbacks.

See [the implementation plan](docs/PLAN.md) for the current structure and proposed next stage. Source files live in `src/`; deploy the generated `dist/` folder to any static host.

## Publish with GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. It builds and deploys `dist/` on pushes to `main`, or on a manual workflow run. Asset URLs are relative so the site works at the repository subpath.

1. Push the commit to GitHub: `git push origin main`.
2. Open [repository Settings → Pages](https://github.com/asharkhxn/bookshelf/settings/pages).
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Open [Actions](https://github.com/asharkhxn/bookshelf/actions), select **Deploy bookshelf to GitHub Pages**, then **Run workflow** on `main`. If a deployment already failed before Pages was enabled, rerun it.
5. When deployment succeeds, open https://asharkhxn.github.io/bookshelf/.

Future pushes to `main` deploy automatically. GitHub Pages must be available for the repository's visibility and account plan; public repositories can use Pages on GitHub Free. Publishing this preview does not add permanent storage.

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
