# Rimal Seafood website

rimalseafood.com: an [Astro](https://astro.build) site, deployed by Netlify from the `main` branch of this repository. A push to `main` is a production deploy.

## How it builds

- `npm run build` builds `src/` into `dist/`. The build reads today's menu from the Manager dashboard tables in Supabase, using the public read-only key.
- `scripts/postbuild.mjs` then copies the staff dashboard (`site/manage.html` and its scripts) and the printable menu into `dist/`. It also writes `dist/_headers`, the security headers, with a hash for every inline script.
- `netlify/functions/refresh-menu.mjs` runs every 15 minutes. When the dashboard data differs from what the site was built with, it calls the Netlify build hook in the `BUILD_HOOK_URL` setting, so menu edits appear without a manual deploy.

## Folders

| Path | What it is |
|---|---|
| `src/` | The website (pages, components, styles, motion) |
| `site/` | The staff dashboard (`manage.html`) and the shared menu data (`menu-data.js`) |
| `menu/` | Printed-menu PDFs. The QR code on the printed menu links here, so keep this path. |
| `tests/` | Playwright + axe tests: `npm test` |
| `*.sql`, `*.txt` | Database setup scripts and older guides |

## Working locally

```
npm install
npm run dev      # http://localhost:4321
npm test         # builds, then tests in Chrome
```

Staff use rimalseafood.com/manage.html. Never rename dishes inside `site/menu-data.js`: the dashboard's edits are keyed by those names.
