import { getTranslations } from "next-intl/server";

import type { BlogCategory, BlogPost } from "@/lib/site/blog-posts";

export interface LocalizedBlogPost {
  slug: string;
  title: string;
  /** Title with the part after the em dash glued together so a hero line break lands before the dash. */
  heroTitle: string;
  /** ISO date for `<time dateTime>`. */
  isoDate: string;
  /** Display date, e.g. "Sep. 05.2026". */
  displayDate: string;
  category: BlogCategory;
  /** Metadata label (e.g. "Music Night"), differs from the tab label ("Music"). */
  categoryLabel: string;
  location: string;
  heroImage: { src: string; alt: string };
  /** First entry = standfirst, the rest = body paragraphs. */
  intro: string[];
  gallery: {
    heading: string;
    description: string;
    photos: { src: string; alt: string }[];
  };
}

// Keeps "— a recap" on one line so the hero title breaks like the design
// ("MUSIC NIGHT UNDER THE STARS" / "— A RECAP") instead of wherever it fits.
function glueAfterDash(title: string) {
  return title.replace(/—\s+(.*)$/, (_, rest: string) => `— ${rest.replace(/ /g, " ")}`);
}

export async function localizePost(post: BlogPost): Promise<LocalizedBlogPost> {
  const t = await getTranslations("blog");
  const base = `posts.${post.i18nKey}`;

  const months = t.raw("months") as string[];
  const [year, month, day] = post.publishedAt.split("-");
  const displayDate = t("dateFormat", {
    month: months[Number(month) - 1] ?? month,
    day,
    year,
  });

  const title = t(`${base}.title`);

  return {
    slug: post.slug,
    title,
    heroTitle: glueAfterDash(title),
    isoDate: post.publishedAt,
    displayDate,
    category: post.category,
    categoryLabel: t(`${base}.categoryLabel`),
    location: t(`${base}.location`),
    heroImage: { src: post.heroImage.src, alt: t(`${base}.heroAlt`) },
    intro: t.raw(`${base}.intro`) as string[],
    gallery: {
      heading: t(`${base}.gallery.heading`),
      description: t(`${base}.gallery.description`),
      photos: post.gallery.map((photo, index) => ({
        src: photo.src,
        alt: t(`${base}.gallery.photoAlt`, { number: index + 1, total: post.gallery.length }),
      })),
    },
  };
}
