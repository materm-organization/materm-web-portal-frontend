// Static content for the Home page teasers. Blog slices are placeholders until
// the blog API/CMS exists (the design shows "Music Night" four times, each
// linking to the single sample article).

export const HOME_BLOG_SAMPLE_SLUG = "music-night-under-the-stars";

// One entry per strip slice, left to right. `key` selects the copy under
// `home.blog.posts.<key>` (title, label, date, excerpt, imageAlt); real posts
// can replace `slug` / `publishedAt` / the copy later.
export const HOME_BLOG_POSTS = [
  { key: "one", slug: HOME_BLOG_SAMPLE_SLUG, publishedAt: "2026-09-05", image: "/images/site/home/blog-card-1.jpg" },
  { key: "two", slug: HOME_BLOG_SAMPLE_SLUG, publishedAt: "2026-09-05", image: "/images/site/home/blog-card-2.jpg" },
  { key: "three", slug: HOME_BLOG_SAMPLE_SLUG, publishedAt: "2026-09-05", image: "/images/site/home/blog-card-3.jpg" },
  { key: "four", slug: HOME_BLOG_SAMPLE_SLUG, publishedAt: "2026-09-05", image: "/images/site/home/blog-card-4.jpg" },
] as const;
