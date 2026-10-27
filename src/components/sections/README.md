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
  single-locale doc (`RichTextDoc`, mapped to paragraphs by `rich-text.ts`; the shared `RichText`
  renderer is T1.2.9). Props are camelCase; the API (snake_case) is converted by the adapter.
- A component also receives `SectionChrome` from the renderer: `domId`, effective `variant`,
  `footerBackdrop`, `priority`. It puts `id={domId}` on its outermost element and builds sub-ids with
  `subId(domId, "title")`. **Never hard-code a DOM id** (the same section type may repeat on a page).
- `registry.ts` maps `key` -> `{versions, variants, frame?, component}`. The first variant is the default
  for a `null` variant. Add a section type = new `types.ts` entry + component + one registry line.
- `SectionRenderer` (Server Component): every section (or frame wrapper) is a direct child of
  `<main>`; the last section gets `footerBackdrop="soft"` when its variant is `soft` (the footer ridge
  selector in `globals.css`); adjacent sections with the same `frame` share one wrapper (`page-column` =
  Gallery's intro text + photo story); only the first section gets `priority`; an unknown key or an
  unsupported version renders nothing and logs once (dev only); duplicate `anchor_id`s become `-2`, `-3`.
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

## Adapters (`adapters/`)

Pre-CMS data source: turn today's typed data (`src/lib/site/*`) + the page i18n namespaces into
`SectionData[]`. `getHomeSections`, `getOurPathSections`, `getGallerySections`, `getContactSections`,
`getBlogIndexSections(category)`. Section ids are readable fixtures (`home-hero` -> DOM id `s-home-hero`).
The CMS data layer (T1.1.14) / API adapters (T1.2.9) replace them with the same output shape.
Shell strings (`site.*`, `blog.index.*`, `forms.errors.*`) are NOT part of the section props: components
read them from the i18n bundle (overridable from `cms_ui_strings`).
