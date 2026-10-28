import Image, { type ImageProps } from "next/image";

import {
  HeroBackdrop,
  HeroContent,
  HeroMotionRoot,
} from "@/components/site/motion/hero-motion";
import { TornEdge } from "@/components/site/torn-edge";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  /** `null`/missing = no photo: the hero keeps its solid `bg-site-green-900` and still shows title and text (only a draft in preview gets here). */
  image?: ImageProps["src"] | null;
  imageAlt: string;
  title: string;
  /** `brand` only: paragraph under the title. */
  description?: string;
  /**
   * `brand`   = centred logo + title + paragraph + CTA slot (Home, Our Path).
   * `article` = bottom-left title + meta row (Blog article, Gallery).
   */
  variant: "brand" | "article";
  /** `article` only: items of the meta row, e.g. [date, category, location]. Empty ones are skipped. */
  meta?: ReadonlyArray<string | null | undefined>;
  /** `brand` only: wide letter-spacing title (Our Path). */
  titleSpacing?: "normal" | "wide";
  /** Slot under the description (`brand`), e.g. <CtaLink/>. */
  children?: React.ReactNode;
  /**
   * Opt-in (all pages use it): the hero content fades/slides in on load (Figma
   * Frame 6 -> 7, 0.8 s ease-out, staggered: `brand` = logo, title, paragraph, CTA;
   * `article` = title, then the meta row), plus a light scroll parallax on the photo
   * and content from `lg` up. Both are off under `prefers-reduced-motion`.
   */
  animateIn?: boolean;
  priority?: boolean;
  /** `brand` only: show the white logo above the title (default true). */
  showLogo?: boolean;
  /** Preview only: a small non-blocking note for the editor (see `PreviewHint`), drawn in the top-left corner. */
  hint?: React.ReactNode;
  /** DOM id of the hero `<section>` (section anchor). */
  id?: string;
  className?: string;
}

// Entrance animation (tw-animate-css, pure CSS): fade + 24px slide up, 0.8 s, Figma
// ease-out. `fill-mode-backwards` keeps items hidden only during their delay, so
// they end visible even without JS; `motion-reduce:animate-none` disables it.
const ENTER =
  "animate-in fade-in slide-in-from-bottom-6 duration-800 ease-(--ease-site-out) fill-mode-backwards motion-reduce:animate-none";

// Full-bleed hero with a torn white edge at the bottom. The site header is a
// bottom-fixed bar (not over the hero), so the `brand` variant is centred with
// symmetric vertical padding that keeps its content clear of the torn edge and
// of the bar. `<h1>` lives here, so pages must not add another one.
export function PageHero({
  image,
  imageAlt,
  title,
  description,
  variant,
  meta,
  titleSpacing = "normal",
  children,
  animateIn = false,
  priority = true,
  showLogo = true,
  hint,
  id,
  className,
}: PageHeroProps) {
  const metaItems = (meta ?? []).filter((item): item is string =>
    Boolean(item),
  );
  const animated = animateIn;
  const Root: React.ElementType = animated ? HeroMotionRoot : "section";
  const Content: React.ElementType = animated ? HeroContent : "div";

  const photo = image ? (
    <Image
      src={image}
      alt={imageAlt}
      fill
      priority={priority}
      sizes="100vw"
      className={cn("object-cover", !animated && "-z-20")}
    />
  ) : null;

  return (
    <Root
      id={id}
      className={cn(
        "relative isolate flex w-full flex-col overflow-hidden bg-site-green-900 text-white",
        variant === "brand"
          ? "min-h-[clamp(560px,65.7vw,1135px)] items-center justify-center px-6 py-[clamp(5rem,13vw,230px)] text-center"
          : "h-[clamp(420px,55vw,951px)] justify-end px-6 pb-[calc(clamp(2rem,4.9vw,85px)+1.5rem)] md:px-12 xl:px-[99px]",
        className,
      )}
    >
      {photo ? (animated ? <HeroBackdrop>{photo}</HeroBackdrop> : photo) : null}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 -z-10",
          variant === "brand"
            ? "bg-linear-to-b from-black/10 via-black/20 to-black/50"
            : "bg-linear-to-b from-transparent via-transparent to-black/55",
        )}
      />

      {variant === "brand" ? (
        <Content className="flex w-full max-w-[933px] flex-col items-center gap-6 sm:gap-8">
          {showLogo ? (
            <Image
              src="/images/site/materm-logo-white.svg"
              alt=""
              width={285}
              height={245}
              priority={priority}
              className={cn(
                "h-auto w-40 sm:w-52 lg:w-[285px]",
                animated && ENTER,
              )}
            />
          ) : null}
          <div className="flex w-full flex-col items-center gap-2">
            <h1
              className={cn(
                "text-3xl font-bold uppercase sm:text-4xl lg:text-[40px]",
                titleSpacing === "wide" &&
                  "tracking-[0.3em] sm:tracking-[0.58em]",
                animated && cn(ENTER, "delay-100"),
              )}
            >
              {title}
            </h1>
            {description ? (
              <p
                className={cn(
                  "max-w-[933px] text-sm capitalize",
                  animated && cn(ENTER, "delay-200"),
                )}
              >
                {description}
              </p>
            ) : null}
            {children ? (
              <div
                className={cn(
                  "mt-8 sm:mt-10",
                  animated && cn(ENTER, "delay-300"),
                )}
              >
                {children}
              </div>
            ) : null}
          </div>
        </Content>
      ) : (
        <Content className="flex w-full max-w-[1368px] flex-col gap-6 lg:gap-[39px]">
          <h1
            className={cn(
              "text-3xl leading-[1.12] font-extrabold tracking-[-0.02em] uppercase sm:text-5xl xl:text-[64px]",
              animated && ENTER,
            )}
          >
            {title}
          </h1>
          {metaItems.length > 0 ? (
            <ul
              className={cn(
                "flex flex-wrap items-center gap-x-6 gap-y-1 text-base text-site-neon",
                animated && cn(ENTER, "delay-200"),
              )}
            >
              {metaItems.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-center gap-6"
                >
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="h-[18px] w-px bg-site-line"
                    />
                  ) : null}
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </Content>
      )}

      {hint}

      <TornEdge
        position="bottom"
        variant={variant === "brand" ? "tall" : "short"}
      />
    </Root>
  );
}
