# Public site building blocks (`src/components/site`)

Shared contract for the Materm marketing site (`src/app/(public)`: `/`, `/our-path`, `/blog`,
`/blog/[slug]`, `/gallery`, `/contact`). Design = Figma file `5j1A77SUISB8zJwvovEh6d`, 1728px desktop; everything
here is fluid down to mobile. There is no login page. `/contact` has no Figma design: it was designed in code
from the existing tokens (see **Contact page** below).

## Rules

- NO shadows anywhere: no `shadow-*`, `drop-shadow`, `text-shadow`, glows or Tailwind `ring-*` (a ring is a box-shadow). Separate surfaces with solid colours / 1 px borders; show keyboard focus with `outline` (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-700` on white, `outline-white` on dark green). Do not combine `outline-none` with `focus-visible:outline-*` (Tailwind v4 then renders no outline). `npm run check:shadows` enforces this.
- Only edit your own page files (`src/app/(public)/<page>/**`, your `i18n/site/<page>.*.json`, your
  `public/images/site/<page>/`). Never edit the shared files below; ask for a change instead.
- shadcn/ui first (`src/components/ui`, already installed: button, tabs, card, badge, separator,
  navigation-menu, sheet, toggle-group, aspect-ratio, carousel, accordion, dialog, skeleton, hover-card,
  scroll-area, tooltip, progress, switch, radio-group, slider...). No `npx shadcn add`, no `npm install`.
- No inline hex colours or one-off styles: use the tokens below.
- Shell copy (nav, footer, CTAs, 404 / error, blog and form labels) comes from i18n (`useTranslations` / `getTranslations`); page copy is CMS content (section props, see `src/components/sections/README.md`). No hard-coded strings.
- Images via `next/image`; static assets in `public/images/site/`.
- No shadows (box/drop/text) anywhere on the public site. Focus indicators use `outline`, not `ring`.

## Layout

`src/app/(public)/layout.tsx` renders `SiteHeader` + `<main id="main">` + `SiteFooter` inside the
`.site` wrapper (white canvas, Noto Sans Lao). The header is `fixed` at the bottom-centre of the viewport, so
no top offset is needed: pages start at the very top and `PageHero` is the first section. Keep key content out of
the bottom ~100px of a 100vh area (the bar floats over it), and note that `(public)/layout.tsx` adds a green spacer
after the footer so the bar never covers the footer's last row. Pages must not render their own header/footer and
should have exactly one `<h1>` (`PageHero` renders it).

## Components

| File | Export / props |
|---|---|
| `site-header.tsx` | `SiteHeader({ chrome })` client; `chrome = { nav, languages, brand }` from `buildSiteChrome` (CMS menu `main`, active locales, settings `brand`); the language chips are the API's `short_label`s, default locale last, hidden when only one locale is active; switching sets the cookie and soft-refreshes (no reload). Fixed at the bottom of the viewport. From `md` up: the centred dark-green Figma bar (5 links + EN\|LAO, active item filled green). Below `md` ("Mountain edge"): a full-bleed dark-green band whose TOP edge is the footer's jagged ridge (`TORN_EDGE_PATHS.short`), with emblem + current page name in Young Serif, EN\|LAO chips and a bordered `MENU` button; both the page name and `MENU` open a bottom `Sheet` that repeats the ridge on top, lists the pages as big Young Serif rows (neon tick on the active one), has a square bordered close button, and an EN\|LAO + emblem row. Solid colours only (no shadow/blur), outline focus. |
| `site-footer.tsx` | `SiteFooter({ chrome })` (`chrome = { brand, footerNav, social }`; statement, copyright, emblem alt from settings, links from the menus `footer` / `social`; social needs an icon we ship: instagram, youtube, facebook, twitter) mountain edge, emblem, statement, links, copyright, 4 social buttons (placeholder URLs). From `lg` up: the Figma layout (brand left, links right, copyright + social on the last row). Below `lg`: a centred stack (large emblem, wordmark, statement, hairline, links as a 2x2 list with dashes — one row of four from `sm` — then social buttons (44 px) and the copyright last). |
| `page-hero.tsx` | `PageHero({ image, imageAlt, title, description?, variant: "brand" \| "article", meta?: (string\|null\|undefined)[], titleSpacing?: "normal" \| "wide", children?, animateIn?: boolean, priority?, className? })`. `brand` = logo + title + paragraph + CTA slot (`children`) for Home / Our Path (`titleSpacing="wide"` for Our Path), centred with symmetric vertical padding (the nav is at the bottom, nothing to clear at the top). `animateIn` (`brand` only, default false, used by Home): logo, title, paragraph and CTA fade + slide up on load (0.8 s ease-out, 0.1 s stagger, pure CSS via tw-animate-css, off under reduced motion) and a light scroll parallax on the photo/content from `lg` up (client wrappers in `components/site/motion/hero-motion.tsx`; the torn edge never moves). `article` = bottom-left title + `meta` row (e.g. `[date, category, location]`) for Blog article / Gallery. Includes the torn edge. |
| `torn-edge.tsx` | `TornEdge({ position?: "bottom" \| "top", variant?: "tall" \| "short", className? })` inline SVG, fill = `currentColor` (default white). Parent must be `relative`. |
| `section-heading.tsx` | `SectionHeading({ eyebrow, title?, description?, variant?: "bar" \| "tick", as?: "h1"\|"h2"\|"h3", className? })`. `tick` (used everywhere) = short green tick + spaced label that GROWS into a long bar up to the label as the page scrolls (`motion/scroll-eyebrow.tsx`, scrubbed by scroll position, reduced motion = stays a tick; Figma component sets `Component 12/14/20`); `bar` = the same long bar, static. |
| `cta-link.tsx` | `CtaLink({ href, children, ...LinkProps })` = `Button asChild variant="site" size="site"` + `next/link`. For custom buttons use `<Button variant="site" size="site">` directly. |
| `gallery-card.tsx` | `GalleryCard({ src, alt, href?, onClick?, children?, caption?, sizes?, priority?, className? })` 430x562 tall rounded card; `children` is an overlay slot (e.g. vertical blog title). `onClick` renders a button (lightbox). `caption={{ date, title }}` adds the Figma hover state (bottom gradient, green tick + neon spaced date, bold uppercase title; opacity + translate 0.3 s ease-out) on hover and keyboard focus (needs `href` or `onClick` to be focusable). |
| `motion/` | Scroll animation foundation, see **Motion** below. |
| `preview-banner.tsx` | `PreviewBanner({ variant: "preview" \| "elsewhere", warnings?, path })` async server component (PF-10, README "Preview"): first child of the page when an editor previews. `fixed top-0` bar (neon, solid, no shadow) with a PREVIEW badge, `site.preview.banner`, an exit button (plain `<a href="/api/preview/exit?path=...">`, never `next/link`) and, under it, one readable line per backend warning code; an `invisible` twin reserves the bar's height. Receives no token. Editor-only copy comes from `src/lib/preview/messages.ts`. |
| `chrome-link.tsx` | `ChromeAnchor({ link, ...anchorProps })`: a CMS menu link (`ChromeLink` from `lib/cms/site-chrome.ts`) as `next/link` (site paths) or `<a>` (http/mailto/tel), `target`/`rel` from the item. No hooks: usable from Server and Client Components. |

Button variants added to `src/components/ui/button.tsx`: `variant="site"` (dark-green rectangle, uppercase,
`bg-site-green-900` -> hover `bg-site-green-600` = Figma `#2a7c13`, `transition-colors duration-[400ms] ease-out`),
`variant="site-icon"`; sizes `site`, `site-icon`.

## Tokens (`globals.css`, additive, admin look untouched)

Colours: `site-green-900/800/700/600/500`, `site-nav` (use `bg-site-nav/88`), `site-nav-chip`, `site-neon`,
`site-ink`, `site-ink-strong`, `site-muted`, `site-mist`, `site-line` -> e.g. `bg-site-green-900`,
`text-site-muted`. Radii: `rounded-site-card` (12px), `rounded-site-photo` (4px).

Fonts (loaded in `src/app/layout.tsx` with `next/font`, scoped by the `.site` wrapper):

| Tailwind | Font | Use |
|---|---|---|
| `font-site` (default inside `.site`) | Noto Sans Lao (variable, weights 100-900) | body, headings |
| `font-site-manrope` (`--font-manrope`; 400/600/700) | Manrope | nav bar, footer copy, blog article standfirst (26px/600) + body (20px/400) |
| `font-site-display` (`--font-young-serif`; 400) | Young Serif | "MATERM" wordmark, Our Path about-block titles (40px, leading 1.15) |

## i18n

`src/i18n/request.ts` merges one file per namespace (static imports, per locale), drops top-level `_`-prefixed marker keys
(`_todoTranslate`), and then overlays the CMS UI strings (P-03, `site,blog,forms`, `applyUiStrings`) so an editor's value wins and
the bundled text is the fallback:

| File | Namespace |
|---|---|
| `i18n/site/common.{en,la}.json` | `site` (nav, footer, shared CTAs `site.cta.*`, `site.gallery.*`, `site.notFound.*`, `site.error.*`; owned by the foundation) |
| `i18n/site/blog.{en,la}.json` | `blog` |
| `i18n/site/forms.{en,la}.json` | `forms` (form error defaults, shared by every form) |
| `i18n/site/home.{en,la}.json`, `our-path`, `gallery`, `contact` | `home`, `ourPath`, `gallery`, `contact`: still registered, but no component reads them any more (the page copy now comes from CMS section props) |

Only `common`, `blog` and `forms` feed the 39 UI-string keys (`npm run cms:export`). We have no Lao translations: the `la` files hold the
English text plus a top-level `"_todoTranslate": true`; do not invent Lao. Use `useTranslations("site")` etc. in shell components.

## Contact page (`/contact`)

Code-designed (no Figma). Files: `src/app/(public)/contact/page.tsx` (hero + sections + metadata),
`src/components/contact/` = `contact-section.tsx` (intro + info 5/12, form 7/12 from `lg`),
`contact-info.tsx` (4 rows: green 48px icon box + label + value, `tel:`/`mailto:` links),
`contact-form.tsx` (client form, `contact.form.*` keys; its server action is `contact/actions.ts`),
`contact-faq.tsx` (shadcn `Accordion` on the `#fafaf7` band, `contact.css` -> `--contact-band`).
The address, phone, email and opening hours are placeholders in the contact page content (`src/content/cms-seed/source/page.contact.json`, `info_items`; later the CMS), and the form's labels come from the CMS form definition (`contact` form, P-14) with the `forms` namespace as error defaults.

## Metadata

All metadata comes from the CMS responses (`src/lib/site-metadata.ts`, doc/08 §3.5):

- layout (`(public)/layout.tsx` `generateMetadata`): `metadataBase` = settings `site.base_url`, title template
  (`%s | Materm`), default description - from `getSite(locale)`.
- CMS page (`(public)/[[...path]]/page.tsx`): `createPageMetadata(page)` = `page.seo` (title, or `{ absolute }` when
  `title_absolute` as on Home, description, `alternates.canonical`, `openGraph.images`, `robots` when `noindex`).
- article (`blog/[slug]`): `createPostMetadata(post)` = `post.seo` + `openGraph.type = "article"` + `publishedTime`.
- `app/sitemap.ts` (P-16, default-locale canonical URLs) and `app/robots.ts` (env only: only `SITE_ENV=production` allows crawling, anything else disallows everything; Netlify `CONTEXT` is build-time only and not read). No hreflang.

Pages no longer export their own `metadata`: edit the SEO fields in the CMS (bundle: `src/content/cms-seed/source`).

## 404 / error

`(public)/not-found.tsx` (`site.notFound.*`) and `(public)/error.tsx` (`site.error.*`, client) use `PageHero brand`
and the site layout (nav, footer). An unknown CMS path or article slug calls `notFound()` (HTTP 404). Do NOT add a
`loading.tsx` above `[[...path]]` or `blog/[slug]`: a Suspense boundary lets the shell stream before `notFound()` /
`permanentRedirect()` runs, which turns the 404 into a 200 and the 308 into a client-side redirect.

## Images

Media URLs come from the CMS (`resolveImage`, `src/lib/cms/media.ts`): relative `/images/site/*` (bundled) or absolute
file-service URLs. There is no host allow-list
(`images.remotePatterns` and `MEDIA_BASE_URL` are gone): the global loader `src/lib/cms/image-loader.ts`
(`next.config.ts` -> `images.loaderFile`) returns an absolute http(s) URL as is (not optimized, the browser loads it
directly) and sends site-relative `/images/*` through the Next optimizer; `<Image>` props stay unchanged. A URL with
an unsafe scheme (`javascript:`, `data:`, protocol-relative) is treated as missing (`image-url.ts`). Every CMS image goes through `site-image.tsx` (`"use client"`): when it fails to load (404, file service down) it renders NOTHING (the `<img>` becomes `invisible`, so the parent's aspect-ratio box / background stays; `onFailure="remove"` renders null, used for logos and emblems); an empty src renders null. Use `SiteImage`, never `next/image` directly. Rich text: `@/components/site/rich-text` (`RichText`).

Shared (flat in `public/images/site/`): `materm-logo-white.svg`, `materm-emblem.svg`,
`hero-forest-stream.jpg` (article/gallery hero), `gallery-card-forest-stream.png`,
`torn-edge*.svg` (reference; the component inlines them), `footer-mountains.svg`, `icon-*.svg`.
Page-specific photos go in `public/images/site/<page>/`, downloaded from Figma (no temporary Figma
URLs in code). Reference them as `/images/site/<file>`.

## Motion (`src/components/site/motion`, library `motion`, import from `motion/react`)

```ts
import { Reveal, revealDelay, ScrollScene, useSceneStates, useStateOpacity,
         sceneStateIndex, SITE_EASE_OUT, SITE_DURATION } from "@/components/site/motion";
```

Tokens: `SITE_EASE_OUT = [0, 0, 0.2, 1]` (Figma EASE_OUT), `SITE_EASE_OUT_CSS`,
`SITE_DURATION = { button: 0.4, card: 0.3, hero: 0.8, reveal: 0.6 }` (seconds), CSS var `--ease-site-out`.

- `<Reveal as? delay? y? once? className?>` - fade + translateY once when entering the viewport (10% inset).
  `as` is a tag name (`div` default, `h2`, `p`, `section`, `li`...). Stagger siblings with
  `delay={revealDelay(i)}` (0.12 s step). Implemented with CSS (`.site-reveal` in `globals.css`) + `useInView`,
  so it is SSR-safe and under `prefers-reduced-motion: reduce` the content is simply visible. Do not put it
  on the pinned node of a `ScrollScene`.
- `<ScrollScene lengthVh top? stickyClassName? staticClassName? className? overflowHidden? staticProgress?>{(progress) => ...}</ScrollScene>`
  - `progress` is a stable `MotionValue<number>` 0 -> 1 (scroll progress through the track, spring-smoothed).
  - Pinned track height = `lengthVh` vh + 100vh; inner node is `sticky`, `top` px (use the header height if the
    scene should sit below the fixed header), height `100vh - top`, `overflow-hidden`.
  - Pins ONLY at `lg`+ and when motion is allowed. Below `lg`, with reduced motion, on the server and on first
    client render it renders the same tree in a plain `relative` block (no fixed height, no clipping) with
    `progress` fixed at `staticProgress` (default 0). So design the static look = the state at `staticProgress`
    (e.g. collage state 1: `0`; blog state 2: `0.25` when n = 5), and make the children stack/size naturally
    when there is no 100vh height (put desktop-only sizing under `lg:` or on `data-pinned`).
- `useSceneStates(progress, states: number[][], { holdRatio = 0.25 })` -> `MotionValue<number>[]` (one per
  column). N states x M values, equally spaced, each state holds for `holdRatio` of a segment, smootherstep
  between. E.g. `const [a, b, c] = useSceneStates(progress, [[3,1,1],[2,1,1],[1,3,1],[1,1,3]])` then
  `style={{ flexGrow: a }}` on `motion.div`.
- `useStateOpacity(progress, index, n)` -> MotionValue 1 while state `index` is held, 0 elsewhere (linear
  cross-fade between neighbours) for captions. `sceneStateIndex(progress, n)` pure nearest-state index (use with
  `useMotionValueEvent` / `useTransform` for text swaps). Pure math also exported: `sceneValueAt`, `stateOpacityAt`.
- `useMediaQuery(query)` SSR-safe (false until mounted).

Client boundary: `ScrollScene` takes a render-prop, so its caller must be a client component (`"use client"`).
Recommended pattern: the server section keeps the text/i18n and passes plain props to one small client
component per scene (`<ExampleScene images={...} />`) that renders `ScrollScene` and the `motion.*` panels;
keep headings/paragraphs in a server component using `<Reveal>` (client, but accepts server children).

```tsx
"use client";
import { motion } from "motion/react";
import { ScrollScene, useSceneStates, useStateOpacity } from "@/components/site/motion";

function Collage({ progress }: { progress: MotionValue<number> }) {
  const [glacier, hiker, climber] = useSceneStates(progress, [[3, 1, 1], [1, 3, 1], [1, 1, 3]]);
  const cap = useStateOpacity(progress, 1, 3);
  return (
    <div className="flex h-[499px] gap-2">
      <motion.div style={{ flexGrow: glacier }} className="relative basis-0">...</motion.div>
      <motion.div style={{ flexGrow: hiker }} className="relative basis-0">...</motion.div>
      <motion.p style={{ opacity: cap }}>Caption</motion.p>
    </div>
  );
}

export function ExampleScene() {
  return (
    <ScrollScene lengthVh={200} top={0} stickyClassName="flex items-center">
      {(progress) => <Collage progress={progress} />}
    </ScrollScene>
  );
}
```

Rules: no pinning, scrubbing or parallax under `prefers-reduced-motion: reduce` or below `lg`; animate only
`opacity`/`transform` (plus the `flex-grow` of a pinned panel); never add shadows.
