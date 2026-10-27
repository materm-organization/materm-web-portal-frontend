import { PageHero } from "@/components/site/page-hero";

import type { SectionComponentProps } from "./types";

// `hero_article`: bottom-left title + meta row (Blog index, Gallery). Provides the page's only <h1>.
export function HeroArticle({
  domId,
  priority,
  title,
  metaItems,
  background,
  animateIn = true,
}: SectionComponentProps<"hero_article">) {
  return (
    <PageHero
      id={domId}
      variant="article"
      image={background.url}
      imageAlt={background.alt}
      title={title}
      meta={metaItems}
      animateIn={animateIn}
      priority={priority}
    />
  );
}
