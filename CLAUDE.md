# CLAUDE.md

This file provides guidance to Claude Code when working on this project.

## What this is

`materm-web-portal-frontend` — the public marketing website for **Materm** (treehouse and camping at
Phou Khao Khouay, Laos), built with Next.js 16 App Router. It is a public site only: pages
**Home** (`/`), **Our Path** (`/our-path`), **Blog** (`/blog`, `/blog/[slug]`) and **Gallery**
(`/gallery`) and **Contact** (`/contact`), all served by one catch-all route from CMS data. There is no login, no admin area and no permissions. Content is read server-side by `src/lib/cms` from the bundled seed (default) or, with `CMS_MODE=api`, from `materm-web-portal-backend` (`X-Portal-Key`); the browser never calls a backend.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| UI kit | shadcn/ui ("new-york" style, `src/components/ui`) + Tailwind v4 |
| i18n | next-intl, cookie-based locale (`la` default, `en`) — no `[locale]` route segment |
| Fonts | `next/font/google` in the root layout (Noto Sans Lao, Manrope, Young Serif, Geist) |
| Theming | `next-themes` provider in the root layout (needed by the sonner toaster); the public site is light-only inside the `.site` wrapper |
| Server state | TanStack React Query provider is mounted but unused (CMS data is fetched on the server by `src/lib/cms`) |

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npm run check:shadows   # fails on any shadow/ring utility in the site scope
npm run check:i18n      # en/la key parity of the message files
npm run cms:check       # bundle + exports are current and valid (cms:export regenerates; cms:mock = mock API; cms:selftest)
npm run site:selftest   # /api/revalidate logic (HMAC, replay, allow-list, limits) + header/footer/switcher data
npm run forms:selftest   # contact form delivery to P-15 (stamp, modes, error mapping, request contract) against the mock API
npm run cms:down-selftest # PF-12: API-down matrix (refused / timeout / 5xx / 401, 403 / invalid body) x every resource family + form + preview + recovery
npm run cms:snapshot    # PF-12: read the running portal API into the bundle's shape (--compare, --out, --apply, --best-effort); see "Fallback and rollback"
npm run preview:selftest # preview flow (PF-10) + draft sections (B5): token/path validation, cookie, sliding refresh, handlers, resolve answer, mock API, adapters on drafts
```

Env vars: `CMS_MODE` (`bundle` default | `mock` | `api`), `NEXT_PUBLIC_API_BASE_URL` / `CMS_API_BASE_URL`, `PORTAL_API_KEY`
(secret), `CMS_FETCH_TIMEOUT_MS`, `MEDIA_BASE_URL` (BUILD time: file-service host for `next/image`), `SITE_ENV` / `CONTEXT`
(robots), `REVALIDATE_SECRET` (secret, >= 32 chars; missing = `/api/revalidate` answers 503), `REVALIDATE_SECRET_PREVIOUS` (rotation),
`REVALIDATE_MAX_SKEW_SECONDS` (default 300), `REVALIDATE_RATE_LIMIT_PER_MINUTE` (default 120), `FORM_RENDER_SECRET` (secret, >= 32 chars, REQUIRED in production for the contact form's signed fill time, see "Contact form"); the endpoint contract is in `README.md`. No secrets in the tracked `.env.*` files (`NEXT_PUBLIC_*` is baked into the client bundle).

## Code layout

- `src/app/layout.tsx` — root layout: fonts, theme provider, next-intl provider, React Query
  provider, toaster.
- `src/app/(public)/` — the public route group. Its `layout.tsx` renders `SiteHeader`, `<main id="main">`
  and `SiteFooter` inside the `.site` wrapper (white canvas, site fonts). Pages are NOT one folder each any more: the
  catch-all `[[...path]]/page.tsx` renders every CMS page (`getPage` -> `adaptPage` -> `SectionRenderer`);
  `blog/[slug]` (article, `getPost`), `not-found.tsx` and `error.tsx` are the only other routes; `src/app/sitemap.ts`
  and `robots.ts` come from the CMS data layer; `src/app/api/revalidate/route.ts` is the revalidation webhook.
- `src/components/site/` — shared site building blocks (header, footer, page hero, section heading,
  CTA link, torn edge, gallery card, chrome link). **Read `src/components/site/README.md` (the
  contract: rules, components, tokens) before touching a page.**
- `src/components/{home,our-path,blog,gallery,contact}/` — the few page-specific pieces left (the sections themselves are in `components/sections/`). `/contact` is code-designed, no Figma; its phone / email / address / hours are placeholders in `src/content/cms-seed/source/page.contact.json` (`info_items`), later the CMS; the form posts to the portal backend's form endpoint P-15 through the server action `contact/actions.ts` and `src/lib/forms/submit.ts` (see "Contact form").
- `src/components/global/language-switcher.tsx` — `useSwitchLocale` (sets the `locale` cookie and soft-refreshes the route with `router.refresh()`, no reload); used by `SiteHeader`. The languages offered are the ones the API returns.
- `src/lib/cms/site-chrome.ts` — `buildSiteChrome(getSite(locale), t)`: header nav, footer nav, social links, brand/footer settings and the language list from the P-05 bundle (items without a published target are skipped, i18n/code defaults when a menu is empty); `(public)/layout.tsx` passes the result to `SiteHeader` / `SiteFooter`.
- `src/app/api/revalidate/route.ts` + `src/lib/revalidate/` — the HMAC-signed revalidation webhook (PF-8).
- `src/components/ui/` — shadcn primitives (some are currently unused; keep them).
- `src/components/provider/` — `theme-provider.tsx`, `query-provider.tsx`.
- `src/lib/cms/` — CMS data layer (loaders, bundle/mock/api modes, media, UI strings; `CMS_MODE`); `src/content/cms-seed/` — bundled
  content; `src/components/sections/` — registry, API->props adapters, `SectionRenderer`; `src/components/site/rich-text.tsx`.
  `src/lib/site/gallery-data.ts` — photo-slot geometry only;
  `src/lib/site-metadata.ts` — layout / page / article metadata from the CMS responses;
  `src/lib/constants/locales.ts` — supported locales and the locale cookie name; `src/lib/utils.ts` — `cn`.
- `src/hooks/use-mobile.ts` — used by `components/ui/sidebar.tsx`.
- `public/images/site/` — static images, referenced via `next/image`.

## API outages (B1)

`src/lib/cms/client.ts`: one budget per call (`CMS_FETCH_TIMEOUT_MS`, 2000); a GET that fails FAST (connection refused/reset, 502/503/504) is retried
ONCE after 100 ms inside that budget, a timeout is never retried. `loaders.ts` falls back to the bundle only for `CmsError.down` (5xx, 401/403/408/429,
timeout, network, bad body, unconfigured) and keeps NO state between calls: the next request asks the API again, so one 503 or one slow answer never
sticks (Next's data cache stores only 200 answers, `patch-fetch.js`). `fallback.ts` logs each (resource, reason) once per minute (it used to be once per
process, which hid a second outage) and caps its maps at 200 keys (page paths are visitor-chosen). Not covered: a route that Next prerenders statically
(`sitemap.xml`) keeps whatever it rendered, bundle fallback included, until its revalidate; backend side: a Redis outage no longer makes the portal
backend slower than this timeout (portal-backend `pkg/redisguard`). Tests: `npm run cms:selftest` section `[5b]`.

## Fallback and rollback (PF-12, PF-14 local part)

- **One fallback, not two.** The snapshot doc/08 §3.10 asks for (`src/content/fallback/**`) already exists as `src/content/cms-seed/data/**` + `index.ts`
  (API response bodies per endpoint and locale, typed with `satisfies BundleData`); the loaders fall back to it and log
  `{"event":"fallback_used","resource","locale","reason":"api_down:<network|timeout|5xx|401|403|invalid|unconfigured>"}` once per minute per (resource, reason).
  No `src/content/fallback/` is created. `scripts/cms/snapshot.mjs` reads a RUNNING portal API into the same tree: default = temp dir, `--compare` diffs it with
  the bundle, `--apply` replaces the bundle with it (`manifest.source = "api"`; `cms:check` then skips the seed rebuild check; `npm run cms:export` returns to the seed),
  `--best-effort` never fails (for a `prebuild` hook, NOT wired: a build must not depend on the API). Needs `PORTAL_API_KEY` + `--base`/`CMS_API_BASE_URL`.
  Not in the fallback by design: P-15 (form says `unavailable`), preview (error page), redirects (a failed redirect lookup stays a 404).
- **Rollback runbook** (site misbehaves in `CMS_MODE=api`): 1) Netlify -> Environment variables -> set `CMS_MODE=bundle` for the context -> trigger a deploy
  (clear cache not needed). The site then reads the bundled snapshot with no API call; the contact form still posts to the API (it says "unavailable" if the API is down).
  2) If the bundle is older than the CMS content, refresh it first on a machine that can reach the API: `PORTAL_API_KEY=... npm run cms:snapshot -- --base <api>/api/v1 --compare`,
  review, then `--apply`, run `npx tsc --noEmit && npm run cms:validate`, commit. 3) Alternatively "Publish deploy" on an earlier successful deploy (no env change).
  4) Return: set `CMS_MODE=api`, redeploy, watch `fallback_used` in the function logs and 5xx. Env names per context: `netlify.toml` (comments; no values in git).
- Parity round 3 (2026-10-29, bundle vs api on production builds against a real portal backend + seeded scratch DB): 7 pages x `la`/`en`, HTML identical after
  normalising the per-build server-action ids, the signed form stamp and the section DOM ids (the seed uses fake UUIDs, the DB real ones).
- Not proven yet (state after the M6 code tasks): pixel parity (the check compares HTML, not rendered pixels), the Netlify deploy and Netlify's support for Next 16.3 (`netlify.toml` is the local part of PF-14 only; the cut-over is phase P4), and the `Dockerfile` / `Jenkinsfile` of this repo are inherited (Jenkinsfile still calls shared company jobs). The commits were pushed at the end of M6.

## CMS redirects (P-17)

`resolveRedirect(path, locale)` in `src/lib/cms/loaders.ts` calls `GET /public/redirects/resolve?path=&locale=` (X-Portal-Key, the normal fetch timeout, tag `redirects`,
revalidate 600). It is called ONLY when the catch-all (`[[...path]]/page.tsx`, `loadPage`) or `blog/[slug]` (`loadPost`) found no published page / post, BEFORE `notFound()`,
so a published page always wins (BR-26). `bundle` and `mock` modes return null without any request (no new env vars). Pure validation in `src/lib/cms/redirects.ts`
(`validateRedirect`): target must be an internal `/path` or an `https://` URL (protocol-relative, `http:`, `javascript:`, whitespace, unknown status = ignored) and must not equal
the requested path (trailing slash / query ignored, loop guard). 404 from the API = no redirect; any other failure (5xx, 429, timeout, network, bad body) = null, logged as
`fallback_used` resource `redirect` (once per minute), the visitor gets the 404; there is no bundle fallback. `generateMetadata` returns `{}` for a redirect, sitemap is untouched.
No `loading.tsx` / Suspense (the status must be decided before streaming).

Status mapping (Next sends only 307 / 308 from a Server Component): 301 -> `permanentRedirect()` = **308**; 308 -> 308; 302 -> `redirect()` = **307**; 307 -> 307.
Crawlers treat 301/308 and 302/307 alike for GET. Tests: `npm run cms:selftest` section `[3b]`.

## Preview (PF-10)

Editor preview of unpublished PAGES (T1.4.6) and POSTS (T1.5.8, M5). Full description in `README.md` ("Preview"). Short version:

- Link from the admin: `/api/preview?token=<raw>&path=/our-path&locale=en`. `src/app/api/preview/route.ts` (logic in
  `src/lib/preview/handlers.ts`) validates token shape and path (whitelist = CMS page path), calls `GET /preview/resolve`
  (`src/lib/cms/preview.ts`: token ONLY in the `X-Preview-Token` header, `cache: "no-store"`, no tags), sets the HttpOnly
  `materm_preview` cookie (`v1.<b64url(path)>.<token>`, SameSite=Lax, Secure except `next dev`, Max-Age 30 min) + Draft Mode and
  307s to the path WITHOUT the token. `/api/preview/exit` clears both. Never link to exit with `next/link` (prefetch).
- Data layer: `(public)/[[...path]]/page.tsx` renders `getPreviewPage` instead of P-06 only when the cookie's path equals the
  request path; same `adaptPage` / `SectionRenderer`; no bundle fallback ever (a failed preview is an error page). Another page of the
  site shows published content + the "elsewhere" banner. A visitor without the cookie gets the same tree and the same cached fetches as
  before (the route was already dynamic through the `locale` cookie; caching lives in Next's data cache).
- `src/proxy.ts` (Next 16 "proxy" = middleware) is the only place that refreshes the cookie (sliding 30 min), matcher gated on the cookie.
  Pure logic in `src/lib/preview/session.ts`. Clearing a cookie needs `Expires` in the past as well as `Max-Age=0` (Next drops `Max-Age=0`
  when it merges the Draft Mode cookies).
- Posts (M5): the link is `/api/preview?token=...&path=/blog/<slug>&locale=en`; `GET /preview/resolve` answers `kind:"post"` with the
  P-08 body in `data.post` (`src/lib/preview/resolve.ts` is a union over `page` / `post`; a draft's `hero` / `category` / `body`
  may be `null`). `blog/[slug]/page.tsx` renders it when the cookie path equals `/blog/<slug>` (BEFORE `getPost`: no 308, no
  data cache; same banner / `noindex` / 401 -> exit / 429 -> status as pages; no hero image gets the editor hint
  `hints.no_hero_image`); on any other article an open session shows the "elsewhere" banner. Fixture tokens in the mock API:
  `mock-preview-post-token-0123456789abcdefghij` and `mock-preview-postdraft-token-0123456789abcdef` (path `/blog/music-night-under-the-stars`).
- Modes: `api` / `mock` only; `bundle` answers `/preview-status?s=unsupported` and ignores the cookie. The preview banner is `fixed top-0`
  (an `invisible` twin reserves its height), solid colours, no token prop. Editor copy: `i18n/site/preview.*.json` via
  `src/lib/preview/messages.ts` (not a next-intl namespace); the shared `site.preview.banner|exit|expired` keys are existing UI strings.
  `/preview-status` is a reserved path.
- Drafts (B5): a preview page is a DRAFT, so publish-required props can be missing. `adaptPage(..., { preview: true })` (only `page.tsx`
  passes it for a preview page) makes the heroes draw their title/text on a neutral `bg-site-green-900` when there is no usable background image,
  with the editor hint "No background image yet" (`PreviewHint`, `i18n/site/preview.*.json` `hints.*`), and replaces any other section whose adapter
  returned null by a `PreviewPlaceholder` that names the section type and the missing fields (`preview-missing.ts` mirrors each adapter's
  `return null` conditions). Visitors never get the hint or a placeholder: their render is byte-identical to before (checked on a production build, 14 pages)
  except that a hero whose image host is not in `MEDIA_BASE_URL` now keeps its title on the neutral background instead of vanishing. Fixture token
  `mock-preview-draft-token-0123456789abcdefgh` (`/our-path`: hero without image, `about_blocks` without items, `gallery_cards` without cards).
- Tests: `npm run preview:selftest` (28) + `scripts/cms/mock-api.mjs` fixture tokens (`PREVIEW_TOKENS`). Never log or echo a token.

## Contact form

`ContactSection` (server) signs the render time into a hidden field (`mintRenderStamp(form.slug)`, `src/lib/forms/render-stamp.ts`,
HMAC with `FORM_RENDER_SECRET`); `ContactForm` (client) posts it with the form slug and the honeypot `company` to the server
action `app/(public)/contact/actions.ts`, which collects the headers and calls `submitContactForm` (`src/lib/forms/submit.ts`):
local validation (`contact-validation.ts`) -> `POST /public/forms/{slug}/submissions` via `cmsFetch(..., { forceApi: true })`
(10 s, never retried) with `honeypot`, `elapsed_ms` (0 for a missing / forged stamp), `rendered_at`, `X-Client-IP`,
`X-Client-User-Agent` -> `mapSubmitResult`: 422 `/data/<field>` -> inline field error, 429 `rateLimited`, 404 `unconfigured`,
5xx / timeout / network / wrong key `unavailable`, other 4xx `generic` (texts: `forms.errors.*`). PRODUCTION always sends (even with
`CMS_MODE=bundle`; no API URL or no `FORM_RENDER_SECRET` = `unconfigured`, never a fake success); outside production only
`CMS_MODE=api` + an API URL sends, every other dev setup simulates success after 600 ms. A genuinely signed stamp older than 24 h
counts as 24 h. Never log the body / e-mail / address. Tests: `npm run forms:selftest`; mock API answers P-15 (magic e-mail addresses
in `scripts/cms/mock-api.mjs`).

## i18n

- Messages are cookie-driven (`locale` cookie; default `la`). `src/i18n/request.ts` loads
  `i18n/{en,la}.json` (both empty `{}`, must stay) and merges the per-namespace files, dropping top-level
  `_`-prefixed marker keys such as `_todoTranslate`; then the CMS UI strings (P-03, `getUiStrings(locale,
  "site,blog,forms")`, flat dotted keys through `applyUiStrings`) are laid over them, so an editor's value wins
  and the bundled text is the fallback when the API is down:

  | File | Namespace | Read by components? |
  |---|---|---|
  | `i18n/site/common.{en,la}.json` | `site` (nav, footer, shared CTAs, 404 / error, gallery shell) | yes |
  | `i18n/site/blog.{en,la}.json` | `blog` | yes (article, category tabs, post list) |
  | `i18n/site/forms.{en,la}.json` | `forms` (form error defaults) | yes (contact form) |
  | `i18n/site/home.{en,la}.json` | `home` | no (page copy moved to CMS content) |
  | `i18n/site/our-path.{en,la}.json` | `ourPath` | no |
  | `i18n/site/gallery.{en,la}.json` | `gallery` | no (shell strings are `site.gallery.*`) |
  | `i18n/site/contact.{en,la}.json` | `contact` | no (form labels come from the CMS form definition, info from the page) |

- Page copy (headings, paragraphs, CTA labels, contact info, FAQ, form fields) is CMS content: section props in
  `src/content/cms-seed/source/page.*.json` for the bundle, the portal API otherwise. Only `common`, `blog` and `forms` are
  the source of the 39 UI-string keys (`npm run cms:export` writes `exports/ui-strings.json`, which seeds the admin
  backend); run it after changing those files.
- To add a namespace: add it to `SITE_NAMESPACES` and a `case` in `loadSiteFile` in `request.ts`,
  and create both locale files.
- Shell copy comes from i18n (`useTranslations` / `getTranslations`); no hard-coded strings. The `la` shell files
  (`common`, `blog`, `forms`, `preview`) and the 39 UI strings are now translated to Lao (`8fc6966`), pending review by a native speaker
  (CSV `/Users/max/Desktop/materm-lao-review.csv`). The `"_todoTranslate": true` flag stays in every `la` file on purpose:
  `scripts/i18n/check-parity.mjs` requires it. The Lao page / post / album copy of the CMS seed (`cms-seed/source/{page,post,album}.*.json`, 126 values) is translated too (no native review); still English in `la`: dates, the brand name, and the menu labels / settings / categories / FAQ / form in `source/menus.json` and `source/reference.json` (their admin copies are SQL seeds, not byte copies).

## Things to know

- Site tokens (`site-*` colours, `font-site*`, `rounded-site-*`) live in `globals.css` and are
  scoped to the `.site` wrapper.
- No shadows anywhere (no `shadow-*`, `drop-shadow`, `text-shadow`, `ring-*`); focus uses `outline`. Run `npm run check:shadows` (`scripts/check-no-shadows.mjs`) before finishing.
- Do not add `/admin`, auth or sign-in code here; the project was deliberately reduced to a public
  marketing site.
- Next.js 16 differs from older versions — see `AGENTS.md` and `node_modules/next/dist/docs/`.
