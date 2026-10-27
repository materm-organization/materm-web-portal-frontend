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
```

## Environment

`.env.development` / `.env.production` define `NEXT_PUBLIC_API_BASE_URL`, reserved for a future
backend (nothing reads it yet). Do not put secrets in these files.

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
The visitor's language is stored in the `locale` cookie and switched from the site header.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev)
- [shadcn/ui](https://ui.shadcn.com)
