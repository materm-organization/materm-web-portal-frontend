import { getSite } from "@/lib/cms/loaders";
import { getRequestLocale } from "@/lib/cms/locale";
import { brandImage } from "@/lib/cms/site-chrome";
import { CtaLink } from "@/components/site/cta-link";
import { PageHero } from "@/components/site/page-hero";

import { PreviewHint } from "@/components/site/preview-hint";

import { ctaLinkProps } from "./cta";
import type { SectionComponentProps } from "./types";

// `hero_brand` (variants `normal` | `wide`; `wide` = the wide letter-spacing title of Our Path
// and Contact). Provides the page's only <h1>. The title keeps its hard line breaks
// (`pre-line`), which collapse to normal wrapping on narrow screens.
export async function HeroBrand({
  domId,
  variant,
  priority,
  title,
  description,
  cta,
  background,
  backgroundVideo,
  previewHint,
  showLogo = true,
  animateIn = true,
}: SectionComponentProps<"hero_brand">) {
  const link = ctaLinkProps(cta);
  // the logo is the one the editors picked in the admin (settings brand.logo_media_id); `getSite` is cached per render
  const logo = showLogo ? brandImage(await getSite(await getRequestLocale()), "logo") : undefined;

  return (
    <PageHero
      id={domId}
      variant="brand"
      titleSpacing={variant === "wide" ? "wide" : "normal"}
      image={background?.url ?? null}
      imageAlt={background?.alt ?? ""}
      video={backgroundVideo ?? null}
      title={title}
      description={description ?? undefined}
      className="[&_h1]:whitespace-pre-line"
      showLogo={showLogo}
      logo={logo}
      animateIn={animateIn}
      priority={priority}
      hint={previewHint ? <PreviewHint code={previewHint} /> : undefined}
    >
      {link ? (
        <CtaLink href={link.href} target={link.target} rel={link.rel} className="sm:w-[294px]">
          {link.label}
        </CtaLink>
      ) : null}
    </PageHero>
  );
}
