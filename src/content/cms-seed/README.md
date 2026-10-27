# cms-seed (bundled CMS content)

Self-contained copy of the design-doc seed; nothing reads `../doc` at run time.

| Folder | What | Edited by |
|---|---|---|
| `source/` | raw seed: page/post/album/menus examples (copies of `doc/content-schemas/examples`), `media-manifest.json` (24 listed files), `reference.json` (locales, settings, categories, FAQ, contact form: authored from `doc/sql/seeds` 001/004/005) | hand / `npm run cms:sync-doc -- <doc>/content-schemas` |
| `schemas/` | the 12 section schemas (copies of `doc/content-schemas/*.json`) | `cms:sync-doc` |
| `exports/` | `media-manifest.json`, `ui-strings.json`: inputs of the admin seed (T1.2.5) | `npm run cms:export` |
| `data/` | portal read-API response bodies per endpoint/locale (what the loaders return) | `npm run cms:export` (never by hand) |
| `index.ts` | generated static JSON imports (`BUNDLE`, typed with `satisfies BundleData`) | `npm run cms:export` |

Commands: `cms:export`, `cms:check` (CI: fails when generated files are stale or invalid), `cms:check:strict`
(also requires all 39 UI-string keys), `cms:validate`, `cms:mock`, `cms:selftest`. Run `cms:export` after changing
`i18n/site/{common,blog,forms}.*.json`, `public/images/site/**` or `source/`.
