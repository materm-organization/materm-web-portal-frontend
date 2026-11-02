# CMS section components (`src/components/sections`)

The 12 section types of the content model (`doc/04-content-model.md` section 3, `doc/content-schemas/`),
one component each, plus the renderer that puts them on a page (`doc/08-portal-integration.md` section 4).
Pages are no longer hand-assembled: a page is a list of `SectionData` handed to `SectionRenderer`.

```tsx
<SectionRenderer sections={await getHomeSections()} />
```

## Contract

- **Props are ALREADY RESOLVED** (`types.ts`): `x-localized` strings are plain strings for the viewer's
  locale, images are `ResolvedImage {url, alt, width, height}` (`alt: ""` = decorative), links are
  `ResolvedLink {label, href}` (`href: null` = target not published, the CTA is not rendered), rich text is a
  single-locale doc (`RichTextDoc`, rendered by the shared `RichText`; `rich-text.ts` only counts
  paragraphs). Props are camelCase; the API (snake_case) is converted by the adapter.
- A component also receives `SectionChrome` from the renderer: `domId`, effective `variant`,
  `footerBackdrop`, `priority`. It puts `id={domId}` on its outermost element and builds sub-ids with
  `subId(domId, "title")`. **Never hard-code a DOM id** (the same section type may repeat on a page).
- `registry.ts` maps `key` -> `{versions, variants, frame?, component}`. The first variant is the default
  for a `null` variant. Add a section type = new `types.ts` entry + component + one registry line.
- `SectionRenderer` (Server Component): every section (or frame wrapper) is a direct child of
  `<main>`; the last section gets `footerBackdrop="soft"` when its variant is `soft` (the footer ridge
  selector in `globals.css`); adjacent sections with the same `frame` share one wrapper (`page-column` =
  Gallery's intro text + photo story); only the first section gets `priority`; an unknown key or an
  unsupported version renders nothing and logs once (dev only; `adaptPage` already filters them and logs in production); duplicate `anchor_id`s become `-2`, `-3`.
- Helpers called from Server Components (`dom-id.ts`, `rich-text.ts`, `cta.ts`, `registry.ts`) must not
  live in `"use client"` files. The client pieces stay where they were: `home/blog-strip*.tsx`,
  `home/our-path-collage.tsx`, `contact/contact-form.tsx`.
- Animation vocabulary stays in code (`Reveal`, `revealDelay`, `PageHero animateIn`, hover flex-grow);
  data only switches `animateIn` on/off. No shadows (`npm run check:shadows` must list this folder).

## Section -> component

| key | component | variants | notes |
|---|---|---|---|
| `hero_brand` | `hero-brand.tsx` | `normal`, `wide` | `PageHero variant="brand"`, title keeps `\n` |
| `hero_article` | `hero-article.tsx` | - | `PageHero variant="article"` |
| `intro_heading` | `intro-heading.tsx` | - | |
| `intro_text` | `intro-text.tsx` | - | frame `page-column` |
| `teaser_collage` | `teaser-collage.tsx` | - | `HomeSection` + `OurPathCollage` |
| `blog_strip` | `blog-strip.tsx` | - | `HomeSection` + client `BlogStrip` |
| `gallery_cards` | `gallery-cards.tsx` + `gallery-cards/frames.tsx` | `home`, `standard`, `showcase` | shell strings `site.gallery.*` |
| `about_blocks` | `about-blocks.tsx` | `soft`, `white` | `ABOUT_IMAGE_RATIO` in code |
| `photo_story` | `photo-story.tsx` | - | frame `page-column` |
| `contact_section` | `contact-section.tsx` | - | form widgets fixed, text from `form` prop |
| `faq` | `faq.tsx` | `soft`, `white` | single-paragraph answer = bare text |
| `post_list` | `post-list.tsx` | - | no pagination yet (PF-5) |

## Adapters (`adapters.ts`, `adapt-page.ts`) - API -> props

One path for every `CMS_MODE` (bundle, mock, api): the page comes from `getPage` (`src/lib/cms`), `adaptPage(page,
{ locale, category })` turns each API section into the `SectionData` the renderer draws, then `SectionRenderer`.

```tsx
const sections = await adaptPage(page, { locale, category });   // src/app/(public)/[[...path]]/page.tsx
return <SectionRenderer sections={sections} />;
```

- `registry.ts` entry = `{ versions, variants, frame?, adapter, component }`. The adapter
  `(section: TypedSection<K>, ctx) => props | null` is in `adapters.ts` (`ADAPTERS` is typed so that a new key does
  not compile without one). `ctx = { locale, media, category, getPosts }`.
- Input is the API shape: snake_case props, `media_id`s resolved through `page.media` (`resolveImage`: placement alt
  wins, decorative = `""`, a URL with an unsafe scheme (not site-relative, not http(s)) counts as missing; any host is fine), `resolved.*`
  (blog posts, cards, album slots, FAQ items, form definition, categories). Output is the camelCase props of
  `types.ts`.
- Draft pages (preview): `adaptPage(page, { locale, category, preview: true })` also reaches the adapters as `ctx.preview`. The heroes
  (`hero_brand`, `hero_article`) no longer need an image: without one `background` is `null`, the title/text are drawn on the neutral
  `bg-site-green-900` and, in preview only, `previewHint: "no_background_image"` shows the editor note. Any other section whose adapter
  returns `null` becomes a `PreviewPlaceholder` (`key: "preview_placeholder"`, props `{ sectionKey, missing }`, see `preview-missing.ts`)
  instead of being skipped; for a visitor nothing changes.
- An adapter returns `null` when the data is not enough (hero without a title, `blog_strip` / `gallery_cards` with no
  items, `teaser_collage` without exactly 3 photos, a FAQ without items...); a throw counts as `null`. `adaptPage` then
  skips the section and logs `{event:"section_invalid", key, version, page_key}` once. An unknown `key`, an
  unsupported `version` or `unsupported: true` is skipped with `{event:"section_unknown", ...}` (also in production,
  doc/08 §4.5). The page still renders.
- `post_list` is the only async adapter: it calls `getPosts(locale, { category, limit: page_size })`; an unknown
  `?category=` falls back to all posts; no pagination yet (PF-5).
- Shell strings (`site.*`, `blog.index.*`, `forms.errors.*`) are NOT part of the section props: components read them
  from the i18n bundle (overridden by `cms_ui_strings` in `src/i18n/request.ts`).
- The fixture adapters (`getHomeSections`...) and `src/lib/site/{home,our-path,blog}*` data were removed in T1.2.9;
  `src/lib/site/gallery-data.ts` keeps only the photo-slot geometry.

## Rich text

`@/components/site/rich-text` (`RichText`) renders a `lite` doc (paragraph, lists, hardBreak, bold, italic, link;
also `lead`, `heading`, `blockquote`) as a fragment: one paragraph = one `<Reveal as="p">`, stagger `delay(index)`
(default `revealDelay`), `paragraphClassName` / `leadClassName` from the caller, `unwrapSingle` + `reveal={false}` for
accordion answers. No `dangerouslySetInnerHTML`; link hrefs are checked (`/x`, `http(s):`, `mailto:`, `tel:` only) and go
through the `ctaLinkProps` rel/target rules. Used by `intro_text`, `about_blocks`, `faq` and the article body.
