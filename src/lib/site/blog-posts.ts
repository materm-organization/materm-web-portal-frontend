// Typed blog data for the public site.
//
// Structure lives here (slug, date, category, imagery); all human-readable
// text (title, location, intro, alt texts) lives in `i18n/site/blog.*.json`
// under `blog.posts.<i18nKey>` so it can be translated. Use
// `localizePost()` from `@/components/blog/localize-post` to get the merged,
// render-ready post.

export const BLOG_CATEGORIES = ["music", "camping", "outdoor", "avenger", "hiking"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export interface BlogPhoto {
  /** Path under `/public`. */
  src: string;
}

export interface BlogPost {
  slug: string;
  /** Key of this post's text block in the `blog.posts` i18n namespace. */
  i18nKey: string;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  /** Tab key; the human label of the category comes from i18n. */
  category: BlogCategory;
  heroImage: BlogPhoto;
  /** Any number of photos; the grid adapts (the design shows 9). */
  gallery: BlogPhoto[];
}

// Placeholder imagery from the design: one stream photo repeated 9 times.
const GALLERY_PLACEHOLDER: BlogPhoto = { src: "/images/site/blog/blog-gallery-rainforest-stream.jpg" };

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "music-night-under-the-stars",
    i18nKey: "musicNight",
    publishedAt: "2026-09-05",
    category: "music",
    heroImage: { src: "/images/site/blog/blog-article-hero-mountains.jpg" },
    gallery: Array.from({ length: 9 }, () => GALLERY_PLACEHOLDER),
  },
];

export function isBlogCategory(value: unknown): value is BlogCategory {
  return typeof value === "string" && (BLOG_CATEGORIES as readonly string[]).includes(value);
}

export function getAllPosts(): readonly BlogPost[] {
  return BLOG_POSTS;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getPostsByCategory(category?: BlogCategory): readonly BlogPost[] {
  return category ? BLOG_POSTS.filter((post) => post.category === category) : BLOG_POSTS;
}
