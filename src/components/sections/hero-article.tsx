import { PageHero } from "@/components/site/page-hero";
import { PreviewHint } from "@/components/site/preview-hint";

import type { SectionComponentProps } from "./types";

// `hero_article`: bottom-left title + meta row (Blog index, Gallery). Provides the page's only <h1>.
export function HeroArticle({
  domId,
  priority,
  title,
  metaItems,
  background,
  previewHint,
  animateIn = true,
}: SectionComponentProps<"hero_article">) {
  return (
    <PageHero
      id={domId}
      variant="article"
      image={background?.url ?? null}
      imageAlt={background?.alt ?? ""}
      title={title}
      meta={metaItems}
      animateIn={animateIn}
      priority={priority}
      hint={previewHint ? <PreviewHint code={previewHint} /> : undefined}
    />
  );
}
