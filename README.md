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

## Contact form

`/contact` has a form (`src/components/contact/contact-form.tsx`, server action in
`src/app/(public)/contact/actions.ts`, shared rules in `contact-validation.ts`). Set the **server-only**
env var `CONTACT_ENDPOINT` (never `NEXT_PUBLIC_*`) to the URL that should receive each message: it gets a
JSON `POST` `{ name, email, phone, topic, message, locale, submittedAt }` (10 s timeout; a non-2xx answer
shows the generic error). Without it, dev/test simulates success after ~600 ms (nothing is sent), and
production shows an "unconfigured" error so the site never pretends to send. TODO: connect a real
mail/CRM endpoint before launch.

## Translations

Per-page message files live in `i18n/site/<page>.{en,la}.json` and are merged into one message tree
by `src/i18n/request.ts` (`common` -> `site`, `home`, `our-path` -> `ourPath`, `blog`, `gallery`).
The visitor's language is stored in the `locale` cookie and switched from the site header without a page reload; the header, footer and switcher are built from the CMS site bundle (menus `main` / `footer` / `social`, settings `brand` / `footer`, the active locales), see `src/lib/cms/site-chrome.ts`.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev)
- [shadcn/ui](https://ui.shadcn.com)
