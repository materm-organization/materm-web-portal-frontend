#!/usr/bin/env node
// Validates the bundled seed (src/content/cms-seed):
//  1. SOURCE layer: every page section's raw props against its section schema (json_schema in
//     schemas/<key>.json, with the structural checker lib/jsonschema.mjs - ajv is not a dependency),
//     variant/version allowed, plus referential integrity (page_id, media_id, post_id, album ids,
//     form_slug, group_key, info_items source).
//  2. EXPORTS: media manifest (24 entries, files exist) and ui-strings (39 keys unless pending).
//  3. DATA layer (what the loaders return): envelopes, manifest counts, every media id used is in the
//     page's media map, no leftover locale maps / link objects, unique section ids.
//  4. PARITY (warnings): reference data vs the copy the pages render today (i18n/site/*.en.json).
//
//   node scripts/cms/validate-seed.mjs [--strict-parity]
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, EXPORT_DIR, I18N_DIR, ROOT, SCHEMA_DIR, SOURCE_DIR, isMain, parseArgs, readJson } from "./lib/util.mjs";
import { validate } from "./lib/jsonschema.mjs";

const PAGE_KEYS = ["home", "our-path", "blog", "gallery", "contact"];
const LOCALE_KEY = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function validateSeed({ strictParity = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);

  const schemas = {};
  for (const f of readdirSync(SCHEMA_DIR).filter((x) => x.endsWith(".json"))) {
    const s = readJson(join(SCHEMA_DIR, f));
    schemas[s.key] = s;
  }
  const pages = Object.fromEntries(PAGE_KEYS.map((k) => [k, readJson(join(SOURCE_DIR, `page.${k}.json`))]));
  const post = readJson(join(SOURCE_DIR, "post.music-night-under-the-stars.json"));
  const album = readJson(join(SOURCE_DIR, "album.forest-photo-story.json"));
  const ref = readJson(join(SOURCE_DIR, "reference.json"));
  const mediaSrc = readJson(join(SOURCE_DIR, "media-manifest.json"));
  const mediaIds = new Set(mediaSrc.map((m) => m.media_id));
  const pageIds = new Set(Object.values(pages).map((p) => p.page.id));
  const postIds = new Set([post.post.id]);
  const albumItemIds = new Set(album.items.map((i) => i.id));
  const faqGroups = new Set(ref.faq_groups.map((g) => g.key));
  const formSlugs = new Set(ref.forms.map((f) => f.slug));
  const settingKeys = new Set(ref.settings.map((s) => `${s.group}.${s.key}`));

  // ---- 1. source layer
  let sectionCount = 0;
  for (const [pk, src] of Object.entries(pages)) {
    for (const s of src.sections) {
      sectionCount++;
      const where = `page.${pk} section ${s.sort_order} (${s.section_type})`;
      const schema = schemas[s.section_type];
      if (!schema) { err(`${where}: no schema for section_type`); continue; }
      if (schema.version !== s.section_version) err(`${where}: version ${s.section_version} != schema ${schema.version}`);
      if (s.variant !== null && !schema.variants.includes(s.variant)) err(`${where}: variant "${s.variant}" not in ${JSON.stringify(schema.variants)}`);
      for (const e of validate(schema.json_schema, s.props)) err(`${where}: ${e}`);
      const walk = (n, path) => {
        if (Array.isArray(n)) return n.forEach((v, i) => walk(v, `${path}/${i}`));
        if (!n || typeof n !== "object") return;
        if (n.type === "page" && "page_id" in n && !pageIds.has(n.page_id)) err(`${where}${path}: page_id ${n.page_id} unknown`);
        if ("media_id" in n && !mediaIds.has(n.media_id)) err(`${where}${path}: media_id ${n.media_id} not in media-manifest`);
        if ("post_id" in n && !postIds.has(n.post_id)) err(`${where}${path}: post_id ${n.post_id} unknown`);
        if ("album_item_id" in n && !albumItemIds.has(n.album_item_id)) err(`${where}${path}: album_item_id ${n.album_item_id} unknown`);
        if ("source" in n && typeof n.source === "string" && n.source.includes(".") && !settingKeys.has(n.source)) err(`${where}${path}: setting ${n.source} unknown`);
        for (const [k, v] of Object.entries(n)) walk(v, `${path}/${k}`);
      };
      walk(s.props, "");
      if (s.props.album_id !== undefined && s.props.album_id !== album.album.id) err(`${where}: album_id ${s.props.album_id} unknown`);
      if (s.props.group_key && !faqGroups.has(s.props.group_key)) err(`${where}: faq group ${s.props.group_key} unknown`);
      if (s.props.form_slug && !formSlugs.has(s.props.form_slug)) err(`${where}: form ${s.props.form_slug} unknown`);
    }
  }
  const menus = readJson(join(SOURCE_DIR, "menus.json"));
  for (const m of Object.values(menus)) for (const it of m.items) if (it.page_id && !pageIds.has(it.page_id)) err(`menu ${m.key}: page_id ${it.page_id} unknown`);
  for (const m of [post.post.hero_media_id, ...post.media.map((x) => x.media_id), album.album.cover_media_id, ...album.items.map((i) => i.media_id)]) {
    if (!mediaIds.has(m)) err(`post/album: media_id ${m} not in media-manifest`);
  }

  // ---- 2. exports
  const mm = join(EXPORT_DIR, "media-manifest.json");
  if (!existsSync(mm)) err("exports/media-manifest.json missing (run npm run cms:export)");
  else {
    const m = readJson(mm);
    if (m.length !== 24) err(`media manifest has ${m.length} entries, expected 24`);
    for (const e of m) {
      if (!existsSync(join(ROOT, e.file))) err(`media ${e.media_id}: file ${e.file} missing`);
      if (!e.width || !e.height || !e.checksum_sha256) err(`media ${e.media_id}: incomplete (width/height/checksum)`);
    }
  }
  const us = join(EXPORT_DIR, "ui-strings.json");
  if (!existsSync(us)) err("exports/ui-strings.json missing (run npm run cms:export)");
  else {
    const u = readJson(us);
    if (u.keys.length + u.pending.length !== 39) err(`ui-strings: ${u.keys.length} keys + ${u.pending.length} pending != 39`);
    if (u.pending.length) warnings.push(`ui-strings: ${u.pending.length} pending key(s): ${u.pending.join(", ")}`);
    for (const k of u.keys) if (k.key.split(".").some((p) => p.startsWith("_"))) err(`ui-strings: exported underscore key ${k.key}`);
  }

  // ---- 3. data layer
  const manifest = existsSync(join(DATA_DIR, "manifest.json")) ? readJson(join(DATA_DIR, "manifest.json")) : null;
  if (!manifest) err("data/manifest.json missing (run npm run cms:export)");
  else {
    const files = [];
    const walkDir = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walkDir(join(d, f)) : files.push(join(d, f))));
    walkDir(DATA_DIR);
    for (const f of files.filter((x) => x.endsWith(".json") && !x.endsWith("manifest.json"))) {
      const env = readJson(f);
      const name = f.slice(DATA_DIR.length + 1);
      if (env.success !== true || !("data" in env)) err(`data/${name}: not an envelope`);
    }
    if (manifest.counts.pages !== PAGE_KEYS.length) err("manifest.counts.pages mismatch");
    const leftover = (n, name, path = "") => {
      if (Array.isArray(n)) return n.forEach((v, i) => leftover(v, name, `${path}/${i}`));
      if (!n || typeof n !== "object") return;
      const keys = Object.keys(n);
      if (keys.length && keys.every((k) => LOCALE_KEY.test(k)) && keys.every((k) => typeof n[k] === "string") && keys.some((k) => ["la", "en"].includes(k))) {
        err(`${name}${path}: uncollapsed locale map ${JSON.stringify(n).slice(0, 60)}`);
      }
      if ("page_id" in n || n.type === "page" || n.type === "url") err(`${name}${path}: uncollapsed link object`);
      for (const [k, v] of Object.entries(n)) leftover(v, name, `${path}/${k}`);
    };
    for (const loc of manifest.locales) {
      for (const [path, key] of Object.entries(manifest.pages)) {
        const name = `data/${loc}/pages/${key}.json`;
        const d = readJson(join(DATA_DIR, loc, "pages", `${key}.json`)).data;
        if (d.page.path !== path) err(`${name}: path ${d.page.path} != manifest ${path}`);
        const ids = new Set();
        const used = new Set();
        const collect = (n) => {
          if (Array.isArray(n)) return n.forEach(collect);
          if (!n || typeof n !== "object") return;
          if (Number.isInteger(n.media_id)) used.add(n.media_id);
          Object.values(n).forEach(collect);
        };
        collect(d.sections);
        collect(d.page.seo);
        for (const id of used) if (!d.media[String(id)]) err(`${name}: media ${id} used but missing in media map`);
        for (const s of d.sections) {
          if (ids.has(s.id)) err(`${name}: duplicate section id ${s.id}`);
          ids.add(s.id);
          if (!schemas[s.key]) err(`${name}: unknown section key ${s.key}`);
        }
        leftover(d.sections, name);
      }
    }
  }

  // ---- 4. parity with the copy the pages render today
  const enFile = (n) => join(I18N_DIR, `${n}.en.json`);
  if (existsSync(enFile("contact")) && existsSync(enFile("common")) && existsSync(enFile("blog"))) {
    const contact = readJson(enFile("contact"));
    const common = readJson(enFile("common"));
    const blog = readJson(enFile("blog"));
    const eq = (what, a, b) => { if (a !== b) warnings.push(`parity: ${what}: seed ${JSON.stringify(a)} vs i18n ${JSON.stringify(b)}`); };
    const set = (g, k) => ref.settings.find((s) => s.group === g && s.key === k)?.value;
    const en = (v) => (v && typeof v === "object" ? v.en : v);
    eq("contact.address", en(set("contact", "address")), contact.info?.visit?.value);
    eq("contact.phone_display", set("contact", "phone_display"), contact.info?.call?.value);
    eq("contact.email", set("contact", "email"), contact.info?.email?.value);
    eq("contact.hours", en(set("contact", "hours")), contact.info?.hours?.value);
    eq("brand.statement", en(set("brand", "statement")), common.footer?.statement);
    eq("footer.copyright", en(set("footer", "copyright")), common.footer?.copyright);
    eq("brand.name", set("brand", "name"), common.brand);
    const faq = ref.faq_groups[0].items.map((i) => i.translations.en);
    const faqI18n = Object.values(contact.faq?.items ?? {});
    eq("faq count", faq.length, faqI18n.length);
    faq.forEach((q, i) => {
      eq(`faq[${i}].question`, q.question, faqI18n[i]?.question);
      eq(`faq[${i}].answer`, q.answer, faqI18n[i]?.answer);
    });
    const form = ref.forms[0];
    eq("form.title", form.translations.en.title, contact.form?.title);
    eq("form.submit", form.translations.en.submit_label, contact.form?.submit);
    for (const f of form.field_order) {
      eq(`form.${f}.label`, form.field_translations[f].en.label, contact.form?.fields?.[f]?.label);
      eq(`form.${f}.placeholder`, form.field_translations[f].en.placeholder ?? undefined, contact.form?.fields?.[f]?.placeholder);
    }
    for (const c of ref.categories) eq(`category ${c.key}`, c.translations.en.name, blog.categories?.[c.key]);
    const navLabel = { home: "home", "our-path": "ourPath", blog: "blog", gallery: "gallery", contact: "contact" };
    for (const it of menus.main.items) {
      const k = Object.entries(pages).find(([, p]) => p.page.id === it.page_id)?.[0];
      eq(`nav.${k}`, it.translations.find((t) => t.locale_code === "en").label, common.nav?.[navLabel[k]]);
    }
  }
  if (strictParity) errors.push(...warnings.filter((w) => w.startsWith("parity:")));

  return { errors, warnings, sectionCount };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const { errors, warnings, sectionCount } = validateSeed({ strictParity: !!args["strict-parity"] });
  for (const w of warnings) console.warn(`validate-seed: warning: ${w}`);
  if (errors.length) {
    console.error(`validate-seed: ${errors.length} error(s)`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`validate-seed: OK (${sectionCount} sections validated against ${readdirSync(SCHEMA_DIR).length} schemas; ${warnings.length} warning(s))`);
}
