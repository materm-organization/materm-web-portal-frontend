"use client";

import Image from "@/components/site/site-image";
import Link from "next/link";
import { useId, useMemo, type FocusEvent, type PointerEvent } from "react";

/** Plain, serialisable post data handed from the server section to the strip. */
export interface BlogStripPost {
  key: string;
  href: string;
  image: string;
  imageAlt: string;
  /** Short upright label shown on a collapsed slice ("Music Night"). */
  label: string;
  title: string;
  date: string;
  /** ISO date for the `<time>` element. */
  dateTime: string;
  excerpt: string;
}

interface BlogStripSliceProps {
  post: BlogStripPost;
  /** 0-based slice index (the first slice is the featured one on < lg). */
  index: number;
  /** Whether this slice is the expanded one (>= lg). */
  expanded: boolean;
  /** Called when the pointer (mouse / pen) enters this slice or it gets keyboard focus. */
  onActivate: () => void;
}

// flex-grow weights of the Figma strip (1367px wide): the expanded slice is 780px, the three
// others share the remaining 587px (195.667 each). Weights sum to 1367, so grow == px at 1367.
export const BLOG_STRIP_GROW_EXPANDED = 780;
export const BLOG_STRIP_GROW_COLLAPSED = 195.667;

// Cross-fade of the caption / label (0.5s, site ease-out); instant under reduced motion.
const FADE = "transition-opacity duration-500 ease-(--ease-site-out) motion-reduce:transition-none";

// Split into user-perceived characters (keeps Lao clusters intact) and drop spaces.
function toLetters(text: string): string[] {
  const upper = text.toLocaleUpperCase();
  const parts =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter("en",{ granularity: "grapheme" }).segment(upper), (s) => s.segment)
      : Array.from(upper);
  return parts.filter((c) => c.trim() !== "");
}

// Figma 170:11974: bottom gradient on the expanded slice, `rgb(0 40 20)` = deep green.
const CAPTION_GRADIENT =
  "bg-[linear-gradient(to_bottom,rgba(0,40,20,0)_64.3%,rgba(0,40,20,0.7)_100%)]";

// Caption geometry, in units of the strip width (container = the `<ul>`):
// 664 / 1367 = 48.57cqw wide (never wider than 664px), centred in the 780px
// (57.06cqw) expanded panel. Fixed width so the excerpt never reflows while
// the slice width animates.
const CAPTION_WIDTH = "min(664px,48.57cqw)";

export function BlogStripSlice({ post, index, expanded, onActivate }: BlogStripSliceProps) {
  const excerptId = useId();
  const letters = useMemo(() => toLetters(post.label), [post.label]);
  const featured = index === 0;

  // Touch taps navigate (the link); only a real hover pointer expands a slice.
  const handlePointerEnter = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "touch") onActivate();
  };
  // Keyboard focus only: a mouse click also focuses the link, which hover already handled.
  const handleFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.matches(":focus-visible")) onActivate();
  };

  return (
    <li
      data-expanded={expanded}
      style={{ flexGrow: expanded ? BLOG_STRIP_GROW_EXPANDED : BLOG_STRIP_GROW_COLLAPSED }}
      className="group/slice relative min-w-0 overflow-hidden transition-[flex-grow] duration-500 ease-(--ease-site-out) motion-reduce:transition-none lg:h-full lg:basis-0"
    >
      <Link
        href={post.href}
        aria-label={post.title}
        aria-describedby={excerptId}
        onPointerEnter={handlePointerEnter}
        onFocus={handleFocus}
        className="relative block focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-site-green-600 lg:absolute lg:inset-0 lg:focus-visible:outline-site-neon"
      >
        <span className="relative block aspect-video overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto">
          <Image
            src={post.image}
            alt={post.imageAlt}
            fill
            // The box is only slice-wide but `cover` scales the bitmap to the strip height:
            // ask for the full-size file or Next serves ~828px and `cover` upscales it.
            sizes="(min-width: 1024px) 1300px, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-center"
          />

          {/* < lg: horizontal label over a bottom gradient. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-site-green-900/70 to-transparent lg:hidden"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-4 text-xl font-bold text-white uppercase lg:hidden"
          >
            {post.label}
          </span>

          {/* >= lg: bottom gradient (expanded slice only). */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 hidden opacity-0 group-data-[expanded=true]/slice:opacity-100 lg:block ${FADE} ${CAPTION_GRADIENT}`}
          />

          {/* >= lg: upright stacked label (Figma: unrotated 28px text wrapped one letter per line, 46px pitch). */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-[46.3%] hidden w-[7.5%] flex-col justify-center group-data-[expanded=true]/slice:opacity-0 lg:flex ${FADE}`}
          >
            {letters.map((letter, i) => (
              <span
                key={`${letter}-${i}`}
                className="block text-[28px] leading-[46px] font-bold whitespace-nowrap text-white"
              >
                {letter}
              </span>
            ))}
          </span>

          {/* >= lg: caption in a fixed-width block at the bottom of the expanded slice. */}
          <span
            aria-hidden="true"
            style={{
              width: CAPTION_WIDTH,
              left: `calc((57.06cqw - ${CAPTION_WIDTH}) / 2)`,
            }}
            className={`pointer-events-none absolute bottom-0 hidden flex-col gap-2 py-11 opacity-0 group-data-[expanded=true]/slice:opacity-100 @container lg:flex ${FADE}`}
          >
            <span className="flex items-center gap-6">
              <span className="w-2 self-stretch bg-site-neon" />
              <time
                dateTime={post.dateTime}
                className="text-[length:clamp(13px,3.01cqw,20px)] leading-[1.65] font-medium tracking-[0.48em] text-site-neon uppercase"
              >
                {post.date}
              </time>
            </span>
            <span className="block text-[length:clamp(16px,4.217cqw,28px)] leading-[1.65] font-bold text-white uppercase">
              {post.title}
            </span>
            <span
              id={excerptId}
              className="block text-[length:clamp(12px,2.41cqw,16px)] leading-[1.65] text-white lowercase"
            >
              {post.excerpt}
            </span>
          </span>
        </span>

        {/* < lg: the featured (first) card carries the caption under its photo. */}
        {featured ? (
          <span aria-hidden="true" className="flex flex-col gap-2 pt-4 lg:hidden">
            <span className="flex items-center gap-4">
              <span className="w-2 self-stretch bg-site-green-600" />
              <time
                dateTime={post.dateTime}
                className="text-base leading-[1.65] font-medium tracking-[0.48em] text-site-green-600 uppercase"
              >
                {post.date}
              </time>
            </span>
            <span className="block text-xl leading-[1.4] font-bold text-site-ink uppercase">{post.title}</span>
            <span className="block text-base leading-[1.65] text-site-ink lowercase">{post.excerpt}</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}
