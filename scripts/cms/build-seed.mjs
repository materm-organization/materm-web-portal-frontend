#!/usr/bin/env node
// Builds the bundled CMS seed: raw seed (src/content/cms-seed/source + schemas + exports)
// -> portal read-API response bodies (src/content/cms-seed/data/**) + the static-import index
// (src/content/cms-seed/index.ts). This is the JS twin of the Go assembler (doc/08 §2.4):
//   * locale maps are collapsed to one string at LEAF level (requested -> fallback_code -> default;
//     "" counts as missing; nothing found -> null), driven by the `x-localized` marks of the schemas
//   * `link` -> href (page_id -> path (+#anchor); unpublished page -> href null); a `link` inside an
//     object (e.g. `cta {label, link}`) is merged into its parent -> `cta {label, href, ...}`
//   * every media_id is gathered into a `media` map (url from storage_key, width/height from the
//     media manifest export)
//   * per-section `resolved` data (blog_strip posts, gallery cards, photo_story slots, contact info
//     + form, faq items, post_list categories)
//
//   node scripts/cms/build-seed.mjs [--check]
//
// Inputs are all inside the repo (nothing reads ../doc). Run `npm run cms:export` first when the
// media files or i18n/site change (it runs the exporters, then this script).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  DATA_DIR, EXPORT_DIR, SCHEMA_DIR, SEED_DIR, SOURCE_DIR, finishCheck, isMain, parseArgs, readJson, rel, toJsonText, writeOrCheck,
} from "./lib/util.mjs";

const PAGE_KEYS = ["home", "our-path", "blog", "gallery", "contact"];
const UPDATED_AT = "2026-01-01T00:00:00Z";
const SECTION_KEYS = [
  "hero_brand", "hero_article", "intro_heading", "intro_text", "teaser_collage", "blog_strip",
  "gallery_cards", "about_blocks", "photo_story", "contact_section", "faq", "post_list",
];

// ---------------------------------------------------------------------------- input

export function loadInputs() {
  const pages = {};
  for (const k of PAGE_KEYS) pages[k] = readJson(join(SOURCE_DIR, `page.${k}.json`));
  const schemas = {};
  for (const k of SECTION_KEYS) schemas[k] = readJson(join(SCHEMA_DIR, `${k}.json`));
  const exportsDir = EXPORT_DIR;
  return {
    pages,
    schemas,
    posts: [readJson(join(SOURCE_DIR, "post.music-night-under-the-stars.json"))],
    albums: [readJson(join(SOURCE_DIR, "album.forest-photo-story.json"))],
    menus: readJson(join(SOURCE_DIR, "menus.json")),
    ref: readJson(join(SOURCE_DIR, "reference.json")),
    mediaManifest: readJson(join(exportsDir, "media-manifest.json")),
    uiStrings: readJson(join(exportsDir, "ui-strings.json")),
  };
}

export function sourceChecksums() {
  const out = {};
  const files = [
    ...readdirSync(SOURCE_DIR).map((f) => join(SOURCE_DIR, f)),
    ...readdirSync(SCHEMA_DIR).map((f) => join(SCHEMA_DIR, f)),
    join(EXPORT_DIR, "media-manifest.json"),
    join(EXPORT_DIR, "ui-strings.json"),
  ].sort();
  for (const f of files) out[rel(f)] = createHash("sha256").update(readFileSync(f)).digest("hex");
  return out;
}

// ---------------------------------------------------------------------------- helpers

/** deterministic uuid-shaped id (v7 layout) from a label */
function pid(label) {
  const h = createHash("sha1").update(`materm-seed:${label}`).digest("hex");
  return `0192e5a0-${h.slice(0, 4)}-7${h.slice(4, 7)}-8${h.slice(7, 10)}-${h.slice(10, 22)}`;
}
const isEmptyText = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const plainDoc = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

export function buildSeed(inputs = loadInputs()) {
  const { pages, schemas, posts, albums, menus, ref, mediaManifest, uiStrings } = inputs;
  const files = new Map(); // relative path under data/ -> JSON value
  const put = (p, v) => files.set(p, v);

  // ---- locales / chains
  const locales = ref.locales.filter((l) => l.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const defaultLocale = locales.find((l) => l.is_default).code;
  const localeByCode = Object.fromEntries(locales.map((l) => [l.code, l]));
  const chainOf = (code) => {
    const chain = [];
    let cur = localeByCode[code] ?? localeByCode[defaultLocale];
    while (cur && !chain.includes(cur.code)) {
      chain.push(cur.code);
      cur = cur.fallback_code ? localeByCode[cur.fallback_code] : null;
    }
    if (!chain.includes(defaultLocale)) chain.push(defaultLocale);
    return chain;
  };
  const publicLocales = locales.map((l) => ({
    code: l.code, name: l.name, native_name: l.native_name, short_label: l.short_label, flag: l.flag,
    is_default: l.is_default, fallback_code: l.fallback_code, date_formats: l.date_formats,
  }));
  put("locales.json", { success: true, data: publicLocales });

  // ---- indexes
  const pageById = new Map();
  for (const k of PAGE_KEYS) {
    const p = pages[k].page;
    if (p.status === "published") pageById.set(p.id, { key: k, path: p.path });
  }
  const categoryById = new Map(ref.categories.map((c, i) => [i + 1, c]));
  const postById = new Map(posts.map((p) => [p.post.id, p]));
  const albumById = new Map(albums.map((a) => [a.album.id, a]));
  const mediaById = new Map(mediaManifest.map((m) => [m.media_id, m]));

  // ---- per-locale builders
  for (const locale of locales.map((l) => l.code)) {
    const chain = chainOf(locale);
    const L = localeByCode[locale];
    const dateFormats = (chain.map((c) => localeByCode[c]?.date_formats).find(Boolean)) ?? L.date_formats;

    const pickText = (map, ctx) => {
      if (map == null || typeof map !== "object") return null;
      for (let i = 0; i < chain.length; i++) {
        const v = map[chain[i]];
        if (!isEmptyText(v)) {
          if (ctx && i > 0) ctx.fallback = true;
          return v;
        }
      }
      return null;
    };
    const pickDoc = (map, ctx) => {
      if (map == null || typeof map !== "object") return null;
      for (let i = 0; i < chain.length; i++) {
        const v = map[chain[i]];
        if (v && typeof v === "object" && v.type === "doc") {
          if (ctx && i > 0) ctx.fallback = true;
          return v;
        }
      }
      return null;
    };
    /** translation row with row-level fallback chain */
    const pickRow = (rows) => {
      for (const code of chain) {
        const r = rows.find((t) => t.locale_code === code && t.is_enabled !== false);
        if (r) return { row: r, resolved: code, fallback: code !== locale };
      }
      return null;
    };

    const formatDate = (iso) => {
      const d = new Date(new Date(iso).getTime() + ref.timezone_offset_minutes * 60000);
      return dateFormats.short
        .replace("{month}", dateFormats.months[d.getUTCMonth()])
        .replace("{day}", String(d.getUTCDate()).padStart(2, "0"))
        .replace("{year}", String(d.getUTCFullYear()));
    };

    // ---- settings (localized leaf -> string)
    const settingsValues = {};
    const settingMediaIds = new Set();
    for (const s of ref.settings) {
      const v = s.localized ? pickText(s.value) : s.value;
      (settingsValues[s.group] ??= {})[s.key] = v ?? null;
      if (s.value_type === "media" && Number.isInteger(v)) settingMediaIds.add(v);
    }
    const baseUrl = settingsValues.site.base_url;

    // ---- media map
    const mediaMap = (ids) => {
      const out = {};
      for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
        const m = mediaById.get(id);
        if (!m) continue; // not ready / unknown -> absent from the map (doc/08 §2.3.1)
        out[String(id)] = {
          url: "/" + m.storage_key.replace(/^static\//, ""),
          width: m.width,
          height: m.height,
          mime: m.mime_type,
          alt: m.alt ? pickText(m.alt) : null,
          blurhash: null,
          focal: null,
          variants: [],
        };
      }
      return out;
    };

    // ---- link / richtext helpers
    const linkOf = (l) => {
      if (!l) return null;
      if (l.type === "page") {
        const p = pageById.get(l.page_id);
        return { href: p ? p.path + (l.anchor ? `#${l.anchor}` : "") : null, open_in_new_tab: false, rel: [] };
      }
      return { href: l.url ?? null, open_in_new_tab: !!l.open_in_new_tab, rel: l.rel ?? [] };
    };
    const richLinks = (node) => {
      if (Array.isArray(node)) return node.map(richLinks);
      if (!node || typeof node !== "object") return node;
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = richLinks(v);
      if (out.type === "link" && out.attrs?.page_id) {
        const p = pageById.get(out.attrs.page_id);
        out.attrs = { href: p ? p.path : null };
      }
      return out;
    };

    // ---- schema-driven collapse of section props
    const deref = (schema, root) => {
      if (!schema.$ref) return schema;
      let cur = root;
      for (const part of schema.$ref.slice(2).split("/")) cur = cur[part];
      const rest = { ...schema };
      delete rest.$ref;
      return { ...cur, ...rest };
    };
    const collapse = (value, schema, root, ctx) => {
      if (value === null || value === undefined) return value;
      if (schema.$ref === "#/$defs/image") {
        ctx.media.add(value.media_id);
        const alt = pickText(value.alt, ctx);
        return { media_id: value.media_id, alt: alt ?? (value.decorative ? "" : null), decorative: !!value.decorative };
      }
      if (schema.$ref === "#/$defs/link") return linkOf(value);
      const s = deref(schema, root);
      if (s["x-localized"]) {
        if (s["x-richtext"]) {
          const doc = pickDoc(value, ctx);
          return doc ? richLinks(doc) : null;
        }
        return pickText(value, ctx);
      }
      if (Array.isArray(value)) return value.map((v) => collapse(v, s.items ?? {}, root, ctx));
      if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = s.properties?.[k] ? collapse(v, s.properties[k], root, ctx) : v;
        if (out.link && typeof out.link === "object" && "href" in out.link) {
          const { link, ...rest } = out;
          return { ...rest, ...link };
        }
        return out;
      }
      if (s["x-ref"] === "media_assets" && Number.isInteger(value)) ctx.media.add(value);
      return value;
    };

    // ---- posts
    const postItem = (po) => {
      const picked = pickRow(po.translations);
      if (!picked || po.post.status !== "published") return null;
      const t = picked.row;
      const cat = categoryById.get(po.post.category_id);
      const catT = cat ? cat.translations[locale] ?? cat.translations[defaultLocale] : null;
      const imageId = po.post.teaser_media_id ?? po.post.hero_media_id;
      return {
        id: po.post.id,
        public_id: pid(`post:${po.post.id}`),
        slug: t.slug,
        href: `/blog/${t.slug}`,
        resolved_locale: picked.resolved,
        is_fallback: picked.fallback,
        title: t.title,
        excerpt: t.excerpt ?? null,
        label: t.label ?? null,
        location_label: t.location_label ?? null,
        date: formatDate(po.post.published_at),
        date_time: po.post.published_at,
        category: cat ? { key: cat.key, name: catT?.name ?? cat.key } : null,
        author: null,
        image: { media_id: imageId, alt: t.hero_alt ?? null },
        is_featured: !!po.post.is_featured,
      };
    };
    const newestFirst = (a, b) => (a.post.published_at < b.post.published_at ? 1 : a.post.published_at > b.post.published_at ? -1 : b.post.id - a.post.id);
    const publishedPosts = posts.filter((p) => p.post.status === "published").sort(newestFirst);

    // posts list (all items; the loaders/mock filter + paginate)
    {
      const ctx = { media: new Set() };
      const items = publishedPosts.map((p) => postItem(p)).filter(Boolean);
      items.forEach((i) => ctx.media.add(i.image.media_id));
      put(`${locale}/posts/list.json`, {
        success: true,
        data: items,
        meta: { total: items.length, page: 1, limit: 12, total_page: Math.max(1, Math.ceil(items.length / 12)) },
        media: mediaMap([...ctx.media]),
      });
    }
    // post detail
    for (const po of publishedPosts) {
      const ctx = { media: new Set() };
      const item = postItem(po);
      if (!item) continue;
      const t = pickRow(po.translations).row;
      const defaultRow = po.translations.find((x) => x.locale_code === defaultLocale) ?? t;
      const galleryItems = po.media
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => {
          ctx.media.add(m.media_id);
          const mt = chain.map((c) => m.translations.find((x) => x.locale_code === c)).find(Boolean);
          return { media_id: m.media_id, alt: mt?.alt ?? null, caption: mt?.caption ?? null };
        });
      const ogId = t.og_image_id ?? po.post.hero_media_id;
      ctx.media.add(po.post.hero_media_id);
      ctx.media.add(ogId);
      const body = t.body ? richLinks(t.body) : null;
      put(`${locale}/posts/${item.slug}.json`, {
        success: true,
        data: {
          locale,
          ...item,
          body,
          hero: { media_id: po.post.hero_media_id, alt: t.hero_alt ?? null },
          gallery: { heading: t.gallery_heading ?? null, description: t.gallery_description ?? null, items: galleryItems },
          tags: [],
          seo: {
            title: t.seo_title ?? t.title,
            description: t.seo_description ?? t.excerpt ?? settingsValues.seo.default_description,
            og_image: { media_id: ogId },
            canonical: `${baseUrl}/blog/${defaultRow.slug}`,
            noindex: false,
          },
          updated_at: po.post.published_at,
          media: mediaMap([...ctx.media]),
        },
      });
    }

    // ---- categories / tags
    put(`${locale}/categories.json`, {
      success: true,
      data: ref.categories.map((c) => {
        const t = c.translations[locale] ?? c.translations[defaultLocale];
        return { key: c.key, name: t.name, slug: t.slug, sort_order: c.sort_order };
      }),
    });
    put(`${locale}/tags.json`, { success: true, data: [] });

    // ---- albums
    const albumItemOf = (album, item) => {
      const tr = chain.map((c) => item.translations.find((x) => x.locale_code === c)).find(Boolean);
      return {
        id: item.id,
        media_id: item.media_id,
        alt: tr?.alt ?? null,
        caption_title: tr?.caption_title ?? null,
        caption_description: tr?.caption_description ?? null,
        sort_order: item.sort_order,
      };
    };
    const albumHead = (a, ctx) => {
      const tr = pickRow(a.translations.map((t) => ({ ...t, is_enabled: true })))?.row;
      ctx.media.add(a.album.cover_media_id);
      return {
        id: a.album.id,
        key: a.album.key,
        title: tr?.title ?? null,
        description: tr?.description ?? null,
        cover: a.album.cover_media_id ? { media_id: a.album.cover_media_id, alt: null } : null,
      };
    };
    {
      const ctx = { media: new Set() };
      const data = albums.filter((a) => a.album.status === "published").map((a) => albumHead(a, ctx));
      put(`${locale}/albums.json`, { success: true, data, media: mediaMap([...ctx.media]) });
    }
    for (const a of albums.filter((x) => x.album.status === "published")) {
      const ctx = { media: new Set() };
      const head = albumHead(a, ctx);
      const items = a.items.slice().sort((x, y) => x.sort_order - y.sort_order).map((it) => {
        ctx.media.add(it.media_id);
        return albumItemOf(a, it);
      });
      put(`${locale}/albums/${a.album.key}.json`, {
        success: true,
        data: { locale, ...head, items, media: mediaMap([...ctx.media]) },
      });
    }

    // ---- faq
    const faqGroup = (key) => {
      const g = ref.faq_groups.find((x) => x.key === key);
      if (!g) return null;
      return {
        locale,
        group_key: g.key,
        resolved_locale: locale,
        items: g.items
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((it) => {
            const t = it.translations[locale] ?? it.translations[defaultLocale];
            return { id: it.id, question: t.question, answer: plainDoc(t.answer) };
          }),
      };
    };
    for (const g of ref.faq_groups) put(`${locale}/faq/${g.key}.json`, { success: true, data: faqGroup(g.key) });

    // ---- forms (definition without recipients / retention / rate limits; x-pii removed)
    const formDef = (slug) => {
      const f = ref.forms.find((x) => x.slug === slug);
      if (!f) return null;
      const t = f.translations[locale] ?? f.translations[defaultLocale];
      const fields = f.field_order.map((key) => {
        const schema = { ...f.json_schema.properties[key] };
        delete schema["x-pii"];
        const ft = f.field_translations[key][locale] ?? f.field_translations[key][defaultLocale];
        const field = {
          key,
          required: f.json_schema.required.includes(key),
          schema,
          label: ft.label,
          placeholder: ft.placeholder ?? null,
          help: null,
        };
        if (schema.enum) field.options = schema.enum.map((value) => ({ value, label: ft.option_labels[value] ?? value }));
        return field;
      });
      return {
        slug: f.slug,
        resolved_locale: locale,
        title: t.title,
        description: t.description,
        submit_label: t.submit_label,
        sending_label: t.sending_label,
        success: { title: t.success_title, description: t.success_description, again_label: t.success_again_label },
        messages: t.messages,
        honeypot_field: f.honeypot_field,
        fields,
        success_redirect_url: f.success_redirect_url,
      };
    };
    for (const f of ref.forms) put(`${locale}/forms/${f.slug}.json`, { success: true, data: formDef(f.slug) });

    // ---- section `resolved`
    const contactInfo = (props) =>
      (props.info_items ?? [])
        .map((it) => {
          const [g, k] = it.source.split(".");
          const raw = settingsValues[g]?.[k];
          if (isEmptyText(raw)) return null;
          let value = raw;
          let href = null;
          if (k === "phone") {
            value = settingsValues.contact.phone_display ?? raw;
            href = `tel:${raw}`;
          } else if (k === "email") href = `mailto:${raw}`;
          else if (k === "address") href = settingsValues.contact.map_url ?? null;
          return { icon: it.icon, label: pickText(it.label), value, href };
        })
        .filter(Boolean);

    const resolveSection = (key, rawProps, props, ctx) => {
      switch (key) {
        case "blog_strip": {
          let candidates;
          if (rawProps.source === "manual") {
            candidates = (rawProps.items ?? []).map((it) => ({ po: postById.get(it.post_id), it }));
          } else {
            const cat = rawProps.category_id;
            candidates = publishedPosts
              .filter((p) => !cat || p.post.category_id === cat)
              .slice(0, rawProps.limit ?? 4)
              .map((po) => ({ po, it: null }));
          }
          const out = [];
          for (const { po, it } of candidates) {
            const item = po && postItem(po);
            if (!item) continue;
            const imgOverride = it?.image ? collapse(it.image, { $ref: "#/$defs/image" }, null, ctx) : null;
            const excerptOverride = it?.excerpt ? pickText(it.excerpt, ctx) : null;
            const finalImage = imgOverride
              ? { media_id: imgOverride.media_id, alt: imgOverride.alt }
              : { media_id: item.image.media_id, alt: item.image.alt };
            ctx.media.add(finalImage.media_id);
            out.push({
              post_id: item.id,
              href: item.href,
              label: item.label,
              title: item.title,
              date: item.date,
              date_time: item.date_time,
              excerpt: excerptOverride ?? item.excerpt,
              image: finalImage,
            });
          }
          return { posts: out.slice(0, 4) };
        }
        case "gallery_cards": {
          const cardsHref = props.cards_link?.href ?? null;
          if (rawProps.source === "album") {
            const a = albumById.get(rawProps.album_id);
            if (!a || a.album.status !== "published") return null;
            const items = a.items.slice().sort((x, y) => x.sort_order - y.sort_order).slice(0, rawProps.limit ?? 3);
            return {
              cards: items.map((it) => {
                ctx.media.add(it.media_id);
                const ai = albumItemOf(a, it);
                return {
                  image: { media_id: it.media_id, alt: ai.alt, decorative: false },
                  caption: ai.caption_title ? { date: null, title: ai.caption_title } : null,
                  href: cardsHref,
                };
              }),
            };
          }
          return {
            cards: (props.cards ?? []).map((c) => ({
              image: c.image,
              caption: c.caption ?? null,
              href: c.href ?? cardsHref,
            })),
          };
        }
        case "photo_story": {
          const a = albumById.get(rawProps.album_id);
          if (!a || a.album.status !== "published") return null;
          const slots = {};
          for (const row of rawProps.rows) {
            for (const slot of row.slots) {
              const it = a.items.find((x) => x.id === slot.album_item_id);
              if (!it) continue;
              ctx.media.add(it.media_id);
              const ai = albumItemOf(a, it);
              slots[String(it.id)] = {
                media_id: it.media_id,
                alt: ai.alt,
                caption_title: ai.caption_title,
                caption_description: ai.caption_description,
              };
            }
          }
          return { slots };
        }
        case "contact_section": {
          const f = rawProps.form_slug ? formDef(rawProps.form_slug) : null;
          return { info: contactInfo(rawProps), form: f };
        }
        case "faq": {
          const g = faqGroup(rawProps.group_key);
          if (!g) return null;
          return { items: g.items };
        }
        case "post_list":
          return {
            categories: ref.categories.map((c) => {
              const t = c.translations[locale] ?? c.translations[defaultLocale];
              return { key: c.key, name: t.name, slug: t.slug, sort_order: c.sort_order };
            }),
          };
        default:
          return {};
      }
    };

    // ---- pages
    for (const k of PAGE_KEYS) {
      const src = pages[k];
      if (src.page.status !== "published") continue;
      const picked = pickRow(src.translations);
      const t = picked.row;
      const ctx = { media: new Set(), fallback: false };
      const sections = [];
      let firstHeroMedia = null;
      src.sections
        .filter((s) => s.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)
        .forEach((s, idx) => {
          const schema = schemas[s.section_type];
          const sctx = { media: ctx.media, fallback: false };
          const props = collapse(s.props, schema.json_schema, schema.json_schema, sctx);
          if (firstHeroMedia === null && s.section_type.startsWith("hero_") && props.background) firstHeroMedia = props.background.media_id;
          const resolved = resolveSection(s.section_type, s.props, props, sctx);
          if (resolved === null) return; // referenced entity not published -> skip the whole section
          sections.push({
            id: pid(`section:${k}:${idx + 1}`),
            key: s.section_type,
            version: s.section_version,
            variant: s.variant,
            anchor_id: s.anchor_id,
            is_fallback: sctx.fallback,
            props,
            resolved,
          });
        });
      // include brand media referenced by layout settings so the page map is self-contained
      const ogId = t.og_image_id ?? firstHeroMedia ?? settingsValues.seo.default_og_media_id ?? null;
      if (ogId) ctx.media.add(ogId);
      put(`${locale}/pages/${k}.json`, {
        success: true,
        data: {
          locale,
          page: {
            id: src.page.id,
            public_id: pid(`page:${src.page.id}`),
            key: src.page.key,
            template: src.page.template,
            path: src.page.path,
            is_home: src.page.is_home,
            resolved_locale: picked.resolved,
            is_fallback: picked.fallback,
            title: t.title,
            updated_at: UPDATED_AT,
            seo: {
              title: t.seo_title ?? t.title,
              title_absolute: !!t.seo_title_absolute,
              description: t.seo_description ?? settingsValues.seo.default_description,
              og_image: ogId ? { media_id: ogId } : null,
              canonical: baseUrl + (t.canonical_path ?? src.page.path),
              noindex: !!src.page.noindex,
            },
          },
          sections,
          media: mediaMap([...ctx.media]),
        },
      });
    }

    // ---- menus
    const menuOf = (key) => {
      const m = menus[key];
      return {
        key: m.key,
        items: m.items
          .filter((i) => i.is_visible)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => {
            const tr = chain.map((c) => i.translations.find((x) => x.locale_code === c)).find(Boolean);
            const href = i.link_type === "page" ? pageById.get(i.page_id)?.path ?? null : i.url;
            return {
              id: i.sort_order,
              label: tr?.label ?? "",
              aria_label: tr?.aria_label ?? null,
              href,
              icon: i.icon,
              open_in_new_tab: !!i.open_in_new_tab,
              rel: i.open_in_new_tab ? ["noopener", "noreferrer"] : [],
              active_match: i.active_match,
            };
          }),
      };
    };
    const menuObjs = { main: menuOf("main"), footer: menuOf("footer"), social: menuOf("social") };
    for (const [k, v] of Object.entries(menuObjs)) put(`${locale}/menus/${k}.json`, { success: true, data: { locale, ...v } });

    // ---- ui strings
    const uiAll = {};
    for (const k of uiStrings.keys) uiAll[k.key] = k.values[locale] ?? k.values[defaultLocale];
    put(`${locale}/ui-strings.json`, { success: true, data: { locale, strings: uiAll } });
    const uiSite = Object.fromEntries(Object.entries(uiAll).filter(([k]) => k.startsWith("site.")));

    // ---- settings + site
    const settingsMedia = mediaMap([...settingMediaIds]);
    put(`${locale}/settings.json`, { success: true, data: { locale, settings: settingsValues, media: settingsMedia } });
    put(`${locale}/site.json`, {
      success: true,
      data: { locale, locales: publicLocales, settings: settingsValues, menus: menuObjs, ui: uiSite, media: settingsMedia },
    });
  }

  // ---- sitemap (default locale only: canonical URLs)
  {
    const entries = [];
    for (const k of PAGE_KEYS) {
      const p = pages[k].page;
      if (p.status === "published" && !p.noindex && p.in_sitemap) {
        entries.push({ kind: "page", entity_id: p.id, path: p.path, lastmod: UPDATED_AT });
      }
    }
    const blogPath = pages.blog.page.path;
    for (const po of posts.filter((x) => x.post.status === "published")) {
      const t = po.translations.find((x) => x.locale_code === defaultLocale) ?? po.translations[0];
      entries.push({ kind: "post", entity_id: po.post.id, path: `${blogPath}/${t.slug}`, lastmod: po.post.published_at });
    }
    put("sitemap.json", {
      success: true,
      data: { locale: defaultLocale, base_url: ref.settings.find((s) => s.group === "site" && s.key === "base_url").value, entries },
    });
  }

  // ---- manifest
  const counts = {
    locales: locales.length,
    pages: PAGE_KEYS.length,
    sections: PAGE_KEYS.reduce((n, k) => n + pages[k].sections.filter((s) => s.is_visible).length, 0),
    posts: posts.length,
    albums: albums.length,
    faq_groups: ref.faq_groups.length,
    forms: ref.forms.length,
    media: mediaManifest.length,
    ui_strings: uiStrings.keys.length,
  };
  put("manifest.json", {
    schema_version: 1,
    source: "seed",
    api_base: null,
    counts,
    default_locale: defaultLocale,
    locales: locales.map((l) => l.code),
    pages: Object.fromEntries(PAGE_KEYS.map((k) => [pages[k].page.path, k])),
    posts: posts.map((p) => ({
      id: p.post.id,
      slugs: Object.fromEntries(p.translations.map((t) => [t.locale_code, t.slug])),
    })),
    albums: albums.map((a) => a.album.key),
    faq_groups: ref.faq_groups.map((g) => g.key),
    forms: ref.forms.map((f) => f.slug),
    menus: ["main", "footer", "social"],
    source_checksums: sourceChecksums(),
  });

  return { files, index: renderIndex([...files.keys()], locales.map((l) => l.code)) };
}

// ---------------------------------------------------------------------------- index.ts

function renderIndex(paths, localeCodes) {
  const ident = (p) => "d_" + p.replace(/\.json$/, "").replace(/[^A-Za-z0-9]+/g, "_");
  const sorted = [...paths].sort();
  const lines = [
    "// GENERATED by scripts/cms/build-seed.mjs - do not edit. Run `npm run cms:export`.",
    "// Static JSON imports (not fs reads) so Next bundles/traces the data for Netlify Functions.",
    'import type { BundleData } from "../../lib/cms/types";',
  ];
  for (const p of sorted) lines.push(`import ${ident(p)} from "./data/${p}";`);
  lines.push("", "export const BUNDLE = {");
  lines.push(`  manifest: ${ident("manifest.json")},`);
  lines.push(`  locales: ${ident("locales.json")},`);
  lines.push(`  sitemap: ${ident("sitemap.json")},`);
  lines.push("  byLocale: {");
  for (const loc of localeCodes) {
    const mine = sorted.filter((p) => p.startsWith(`${loc}/`));
    const group = (dir) => mine.filter((p) => p.startsWith(`${loc}/${dir}/`));
    const keyOf = (p, dir) => p.slice(`${loc}/${dir}/`.length).replace(/\.json$/, "");
    const map = (dir, skip) =>
      "{ " + group(dir).filter((p) => !skip || keyOf(p, dir) !== skip).map((p) => `${JSON.stringify(keyOf(p, dir))}: ${ident(p)}`).join(", ") + " }";
    lines.push(`    ${JSON.stringify(loc)}: {`);
    lines.push(`      site: ${ident(`${loc}/site.json`)},`);
    lines.push(`      settings: ${ident(`${loc}/settings.json`)},`);
    lines.push(`      uiStrings: ${ident(`${loc}/ui-strings.json`)},`);
    lines.push(`      categories: ${ident(`${loc}/categories.json`)},`);
    lines.push(`      tags: ${ident(`${loc}/tags.json`)},`);
    lines.push(`      albums: ${ident(`${loc}/albums.json`)},`);
    lines.push(`      postList: ${ident(`${loc}/posts/list.json`)},`);
    lines.push(`      menus: ${map("menus")},`);
    lines.push(`      pages: ${map("pages")},`);
    lines.push(`      posts: ${map("posts", "list")},`);
    lines.push(`      albumsByKey: ${map("albums")},`);
    lines.push(`      faq: ${map("faq")},`);
    lines.push(`      forms: ${map("forms")},`);
    lines.push("    },");
  }
  lines.push("  },");
  lines.push("} satisfies BundleData;", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------- main

function listJson(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listJson(p, base) : [p.slice(base.length + 1).split("\\").join("/")];
  });
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const check = !!args.check;
  const { files, index } = buildSeed();
  const stale = [];
  for (const [p, v] of files) writeOrCheck(join(DATA_DIR, p), toJsonText(v), { check, stale });
  writeOrCheck(join(SEED_DIR, "index.ts"), index, { check, stale });
  // files that no longer belong to the output
  for (const p of listJson(DATA_DIR)) {
    if (!files.has(p)) {
      if (check) stale.push(rel(join(DATA_DIR, p)) + " (extra)");
      else rmSync(join(DATA_DIR, p));
    }
  }
  if (check) finishCheck(stale, "build-seed", "Run: npm run cms:export");
  else console.log(`build-seed: ${files.size} data files + index.ts -> ${rel(SEED_DIR)}`);
}
