# materm-web-portal-frontend

Public marketing website for **Materm** — treehouse and camping at Phou Khao Khouay, Laos. A Next.js
16 App Router app with four pages: **Home**, **Our Path**, **Blog** and **Gallery**. There is no
login or admin area.

## Routes (`src/app/(public)`)

| Route | Page |
|---|---|
| `/` | Home |
| `/our-path` | Our Path |
| `/blog` | Blog list |
| `/blog/[slug]` | Blog article |
| `/gallery` | Gallery |
| `/preview-status` | where the preview flow ends without a page (expired link, no backend, busy); noindex |
| `/api/preview`, `/api/preview/exit` | start / leave an editor preview (below) |

Shared header/footer and page building blocks live in `src/components/site`; see
`src/components/site/README.md` for the contract.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui, next-intl (cookie-based locale: `la`
default, `en`), `next/font/google`.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npm run check:shadows   # no shadow-*/ring-* in the site scope (focus uses outline)
npm run site:selftest   # /api/revalidate branches + header/footer/switcher data (no network, no Next runtime)
```

## Environment

`.env.development` / `.env.production` define `NEXT_PUBLIC_API_BASE_URL`, reserved for a future
backend (nothing reads it yet). Do not put secrets in these files.

## On-demand revalidation (`POST /api/revalidate`)

The admin-backend relay calls this endpoint after a publish / save-live so the site shows the change within
seconds (doc/08 §7.2). **Server-only** env vars (never `NEXT_PUBLIC_*`, never in the tracked `.env.*` files; set
them in Netlify per context or in `.env.local`):

| Variable | Meaning |
|---|---|
| `REVALIDATE_SECRET` | HMAC key, at least 32 characters. **Missing or shorter: the endpoint answers 503 and accepts nothing** (fail closed). |
| `REVALIDATE_SECRET_PREVIOUS` | Optional, the old key while rotating: signatures made with either key are accepted. |
| `REVALIDATE_MAX_SKEW_SECONDS` | Accepted distance between the signed timestamp and the server clock (default 300, 30-900). |
| `REVALIDATE_RATE_LIMIT_PER_MINUTE` | Ceiling of authenticated requests per minute per server instance (default 120). Failed authentications are throttled separately, per client address (20 per minute, then 429 instead of 401; a correctly signed request is never throttled). |

Request: `POST /api/revalidate`, headers `X-Materm-Timestamp: <unix seconds>` and
`X-Materm-Signature: v1=<hex HMAC-SHA256(REVALIDATE_SECRET, timestamp + "." + rawBody)>`, JSON body
`{"event_id": "<id, 1-64 printable chars>", "tags": ["pages", "settings"], "sent_at"?: "<RFC 3339>", "occurred_at"?: "<RFC 3339>"}`
(at most 16 KiB and 128 tags). Answers: `200 {"success":true,"data":{"revalidated":[...],"ignored":[...]}}`
(`"duplicate":true` and nothing applied when the `event_id` was already seen), `400` bad body, `401` bad,
missing or stale signature, `413` too large, `429` rate limited, `503` secret not configured. Only tags that
match the allow-list in `src/lib/cms/tags.ts` are revalidated (`revalidateTag(tag, { expire: 0 })`; the `sitemap` tag
also revalidates `/sitemap.xml`); anything else is returned in `ignored`. Nothing sensitive is logged (no secret,
signature or body). The replay store and the limiters are in memory, per server instance.

Try it by hand against `next start` / `next dev` (the script reads the secret from the environment and never prints it):

```bash
export REVALIDATE_SECRET=$(openssl rand -hex 24)   # also start the server with this value
node scripts/cms/revalidate-demo.mjs --tags pages,settings,sitemap --replay
node scripts/cms/revalidate-demo.mjs --bad-signature   # 401
node scripts/cms/revalidate-demo.mjs --stale           # 401
```

## Deploy, fallback, rollback

`netlify.toml` holds the build and header settings and, as comments, the environment variable NAMES per deploy context (values live only in Netlify). When the API is down the site serves the bundled snapshot (`src/content/cms-seed`) and logs `fallback_used`; `npm run cms:down-selftest` proves it for every resource family. Rollback = `CMS_MODE=bundle` + redeploy; details in `CLAUDE.md` ("Fallback and rollback").

## Preview (PF-10, `/api/preview`)

An editor previews an unpublished page from the admin. The admin issues a link
`https://<site>/api/preview?token=<raw>&path=/our-path&locale=en` (open it in a NEW tab; an iframe is not built, the
`frame-ancestors` CSP of doc/08 §3.9 is not set). Preview needs `CMS_MODE=api` (the real portal-backend) or
`CMS_MODE=mock` (`npm run cms:mock`, see below); in `bundle` mode `/api/preview` answers a clear
"preview needs `CMS_MODE=api`" page and a preview cookie is ignored. **Pages** (`/our-path`) and **posts** (`/blog/<slug>`, M5) can be previewed: a post link renders the article page from `data.post` of `GET /preview/resolve` (same markup as the published article, plus the banner and `noindex`; no 308, no data cache).

```bash
npm run cms:mock                       # in one terminal (MOCK_LOG=1 prints one line per request)
CMS_MODE=mock npm run dev              # in another, then open:
#   http://localhost:3000/api/preview?token=mock-preview-valid-token-0123456789abcdef&path=/our-path&locale=en
#   .../api/preview?token=mock-preview-warnings-token-0123456789abcdef&path=/contact   (resolved:{} sections + warnings)
#   .../api/preview?token=mock-preview-expired-token-0123456789abcdef&path=/our-path   (expired page)
npm run preview:selftest               # logic, cookie attributes, sliding refresh, open-redirect attempts, fetch options
```

Flow:

1. `GET /api/preview` reads `token`, `path`, `locale` **once**; the token must be 32-256 chars of `[A-Za-z0-9._~-]`; `path` must
   be a CMS page path (`/`, `/our-path`, `/a/b`: lowercase letters, digits, `-`; no `//`, `\`, scheme, query or `%`), otherwise
   it is treated as a dead link. It asks the backend (`GET /preview/resolve`, token in the `X-Preview-Token` header,
   `X-Portal-Key` from `PORTAL_API_KEY`). 401 `INVALID_TOKEN` / 422 -> the **expired page** (`/preview-status?s=expired`, copy
   `site.preview.expired`; never says why: unknown, expired, revoked, other page); 429 -> "try again" page; backend trouble
   (including a wrong portal key) -> "unavailable" page, never the published content.
2. On success it sets the cookie `materm_preview`, turns on Next Draft Mode (every `fetch` of that browser skips the data
   cache) and answers **307** to the page path **without the token** (relative `Location`, `Cache-Control: no-store`,
   `Referrer-Policy: no-referrer`). The link's `locale` (if we ship it) becomes the site `locale` cookie.
3. A request with the cookie **for the page the link was issued for** is rendered from `GET /preview/resolve` instead of P-06,
   through the same `adaptPage` / `SectionRenderer` pipeline (`resolved: {}` sections are tolerated; an empty faq / gallery
   section is simply not drawn), plus the banner and `robots: noindex, nofollow`. Any **other** page shows the published content with
   a slim banner ("your preview session is still open", back link, exit): the backend ties a token to one page, so another
   path is not a dead link. A dead token on its own page (401/422) redirects through `/api/preview/exit?reason=expired`
   (a Server Component cannot delete a cookie) to the expired page; 429 / 5xx redirect to the status page and keep the cookie.
4. **Exit** = the banner's plain `<a href="/api/preview/exit?path=...">` (never `next/link`: a prefetch would end the session):
   GET or POST, clears the cookie and Draft Mode, redirects to the page without preview (or `/`).

Cookie: `materm_preview`, `HttpOnly`, `SameSite=Lax` (doc/08 said `None` for an iframe we do not build), `Path=/`, `Secure`
(everywhere except `next dev`; `localhost` / `127.0.0.1` accept it over http), value `v1.<base64url(path)>.<token>`.
**Sliding Max-Age = 30 minutes of inactivity**, refreshed on every page request that carries it by `src/proxy.ts` (the
only place that can write a cookie while a page renders; its matcher only fires when the cookie is present, so visitors never
run it; prefetches, `_next`, `api` and files do not extend the session). This closes the open note of doc/08 §3.9: the link
may live up to 24 h (the admin's `expires_at`), the cookie lives 30 min after the last request (option b), and an
editor who comes back later opens the link again.

Public pages stay cached: the catch-all was **already dynamic** (it reads the `locale` cookie, `ƒ` in the build output before
and after), what is cached for visitors is Next's **data cache** (`force-cache` + tags in `src/lib/cms/client.ts`). A preview
request neither reads nor writes it: the resolve call is `cache: "no-store"` without tags, and Draft Mode bypasses the data
cache for the shell fetches (site, ui strings, locales) too. Reading the preview cookie adds no cost for visitors and their
HTML is unchanged (the page returns exactly the same tree when there is no session). Files: `src/lib/preview/*` (pure logic,
unit-tested), `src/lib/cms/preview.ts` (the backend call), `src/app/api/preview/**`, `src/proxy.ts`,
`src/components/site/preview-banner.tsx`, `src/app/(public)/preview-status/page.tsx`, editor-only copy in
`i18n/site/preview.{en,la}.json` (read by `src/lib/preview/messages.ts`, deliberately NOT a next-intl namespace so visitors
do not download it; the `la` file is an English copy marked `_todoTranslate`). The shared strings `site.preview.banner|exit|expired`
are the existing UI strings.

Security: the token is never in `NEXT_PUBLIC_*`, never logged (route handlers and the loader log nothing about it; `next dev`
does not print `/api/preview` requests, `next.config.ts` `logging.incomingRequests.ignore`), never in a URL after the first hop,
never a prop of a component and never in the HTML / RSC payload (the cookie is HttpOnly and read only on the server).
`/api/preview*` responses carry `no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`.

`npm run cms:mock` also serves `GET /api/v1/preview/resolve` with fixture tokens (list at the top of
`scripts/cms/mock-api.mjs`): a valid page snapshot, a snapshot with `resolved: {}` sections + warnings, expired (401),
rate limited (429), broken (500), malformed / missing token (422), same response headers as the real backend.

## Contact form

`/contact` has a form (`src/components/contact/contact-form.tsx`, server action in
`src/app/(public)/contact/actions.ts`, the delivery rules in `src/lib/forms/submit.ts`, shared field rules in
`contact-validation.ts`). A valid submission is posted **server-side** to the portal backend, `POST
/api/v1/public/forms/{slug}/submissions` (P-15, `X-Portal-Key` from `PORTAL_API_KEY`; the browser never calls a backend).
Messages are stored and e-mailed by the admin side; there is no other delivery URL.

- **Anti-spam contract** (doc/08 section 6.3, backend `modules/forms`): the hidden honeypot field `company` is forwarded as
  `honeypot` (the backend scores it and still answers 200, a bot learns nothing); `elapsed_ms` comes from a **signed fill
  time** (hidden field `rt`, minted by the server in `ContactSection`, checked by the action with `FORM_RENDER_SECRET`);
  `X-Client-IP` (`x-nf-client-connection-ip`, then `x-real-ip`, then the first `x-forwarded-for`) and `X-Client-User-Agent`
  carry the visitor, otherwise the whole site would share one rate-limit bucket.
- **`FORM_RENDER_SECRET`**: server-only secret, >= 32 characters, **required in production** (without it no visitor can prove
  a fill time and every real message would be stored as spam, so the form answers "unconfigured" instead). Unset in development:
  a random per-process secret is used.
- **Modes**: production always calls the real API, whatever `CMS_MODE` says (`CMS_MODE` only decides where content is read
  from). Production without an API base URL: "unconfigured". Outside production a message is only sent with `CMS_MODE=api`
  and an API base URL; in every other dev setup (bundle, mock, no URL) the form simulates success after ~600 ms and nothing is
  sent, so the site runs without a backend.
- **Errors** (backend answer -> text from `forms.errors.*`, overridable per form): 422 on `/data/<field>` -> that field's
  message; 429 -> `rateLimited`; 404 -> `unconfigured`; 5xx, timeout (10 s), network, wrong portal key -> `unavailable`;
  400 / 413 / 415 and a 422 without a field the form can show -> `generic`. A POST is never retried.
- Try the error paths without a backend: `npm run cms:mock` answers P-15 and reacts to the addresses `limited@example.test`
  (429), `invalid@example.test` (422), `gone@example.test` (404), `down@example.test` (503); use `CMS_MODE=api` with
  `CMS_API_BASE_URL=http://127.0.0.1:4010/api/v1`. `npm run forms:selftest` checks all of it.

## Translations

Per-page message files live in `i18n/site/<page>.{en,la}.json` and are merged into one message tree
by `src/i18n/request.ts` (`common` -> `site`, `home`, `our-path` -> `ourPath`, `blog`, `gallery`).
The visitor's language is stored in the `locale` cookie and switched from the site header without a page reload; the header, footer and switcher are built from the CMS site bundle (menus `main` / `footer` / `social`, settings `brand` / `footer`, the active locales), see `src/lib/cms/site-chrome.ts`.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev)
- [shadcn/ui](https://ui.shadcn.com)
