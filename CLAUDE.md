# CLAUDE.md

This file provides guidance to Claude Code when working on this project.

## What this is

`materm-web-portal-frontend` — the public marketing website for **Materm** (treehouse and camping at
Phou Khao Khouay, Laos), built with Next.js 16 App Router. It is a public site only: pages
**Home** (`/`), **Our Path** (`/our-path`), **Blog** (`/blog`, `/blog/[slug]`) and **Gallery**
(`/gallery`) and **Contact** (`/contact`). There is no login, no admin area, no permissions and no backend calls yet.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| UI kit | shadcn/ui ("new-york" style, `src/components/ui`) + Tailwind v4 |
| i18n | next-intl, cookie-based locale (`la` default, `en`) — no `[locale]` route segment |
| Fonts | `next/font/google` in the root layout (Noto Sans Lao, Manrope, Young Serif, Geist) |
| Theming | `next-themes` provider in the root layout (needed by the sonner toaster); the public site is light-only inside the `.site` wrapper |
| Server state | TanStack React Query provider is mounted but unused (kept for the future backend) |

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npm run check:shadows   # fails on any shadow/ring utility in the site scope
```

Env vars: `CMS_MODE` (`bundle` default | `mock` | `api`), `NEXT_PUBLIC_API_BASE_URL` / `CMS_API_BASE_URL`, `PORTAL_API_KEY`
(secret), `CMS_FETCH_TIMEOUT_MS`, `MEDIA_BASE_URL` (BUILD time: file-service host for `next/image`), `SITE_ENV` / `CONTEXT`
(robots). No secrets in the tracked `.env.*` files (`NEXT_PUBLIC_*` is baked into the client bundle).

## Code layout

- `src/app/layout.tsx` — root layout: fonts, theme provider, next-intl provider, React Query
  provider, toaster.
- `src/app/(public)/` — the public route group. Its `layout.tsx` renders `SiteHeader`, `<main id="main">`
  and `SiteFooter` inside the `.site` wrapper (white canvas, site fonts). Pages are NOT one folder each any more: the
  catch-all `[[...path]]/page.tsx` renders every CMS page (`getPage` -> `adaptPage` -> `SectionRenderer`);
  `blog/[slug]` (article, `getPost`), `not-found.tsx` and `error.tsx` are the only other routes; `src/app/sitemap.ts`
  and `robots.ts` come from the CMS data layer.
- `src/components/site/` — shared site building blocks (header, footer, page hero, section heading,
  CTA link, torn edge, gallery card, nav items). **Read `src/components/site/README.md` (the
  contract: rules, components, tokens) before touching a page.**
- `src/components/{home,our-path,blog,gallery,contact}/` — page-specific components (`/contact` is code-designed, no Figma; contact details in `i18n/site/contact.*.json` `info.*.value` are placeholders to replace).
- `src/components/global/language-switcher.tsx` — `switchLocale` (sets the `locale` cookie and
  reloads); used by `SiteHeader`.
- `src/components/ui/` — shadcn primitives (some are currently unused; keep them).
- `src/components/provider/` — `theme-provider.tsx`, `query-provider.tsx`.
- `src/lib/cms/` — CMS data layer (loaders, bundle/mock/api modes, media, UI strings; `CMS_MODE`); `src/content/cms-seed/` — bundled
  content; `src/components/sections/` — registry, API->props adapters, `SectionRenderer`; `src/components/site/rich-text.tsx`.
  `src/lib/site/gallery-data.ts` — photo-slot geometry only;
  `src/lib/site-metadata.ts` — layout / page / article metadata from the CMS responses;
  `src/lib/constants/locales.ts` — supported locales and the locale cookie name; `src/lib/utils.ts` — `cn`.
- `src/hooks/use-mobile.ts` — used by `components/ui/sidebar.tsx`.
- `public/images/site/` — static images, referenced via `next/image`.

## i18n

- Messages are cookie-driven (`locale` cookie; default `la`). `src/i18n/request.ts` loads
  `i18n/{en,la}.json` (both currently empty `{}`) and merges the per-page files under top-level
  namespaces:

  | File | Namespace |
  |---|---|
  | `i18n/site/common.{en,la}.json` | `site` (nav, footer, shared CTAs) |
  | `i18n/site/home.{en,la}.json` | `home` |
  | `i18n/site/our-path.{en,la}.json` | `ourPath` |
  | `i18n/site/blog.{en,la}.json` | `blog` |
  | `i18n/site/gallery.{en,la}.json` | `gallery` |
  | `i18n/site/contact.{en,la}.json` | `contact` |

- To add a namespace: add it to `SITE_NAMESPACES` and a `case` in `loadSiteFile` in `request.ts`,
  and create both locale files.
- All visible copy comes from i18n (`useTranslations` / `getTranslations`); no hard-coded strings.

## Things to know

- Site tokens (`site-*` colours, `font-site*`, `rounded-site-*`) live in `globals.css` and are
  scoped to the `.site` wrapper.
- No shadows anywhere (no `shadow-*`, `drop-shadow`, `text-shadow`, `ring-*`); focus uses `outline`. Run `npm run check:shadows` (`scripts/check-no-shadows.mjs`) before finishing.
- Do not add `/admin`, auth or sign-in code here; the project was deliberately reduced to a public
  marketing site.
- Next.js 16 differs from older versions — see `AGENTS.md` and `node_modules/next/dist/docs/`.
