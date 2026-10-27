"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

import { SITE_PIN_QUERY } from "./tokens";
import { useMediaQuery } from "./use-media-query";

// Scroll parallax for the Home hero (opt-in through `PageHero animateIn`).
// The hero <section> is rendered by `HeroMotionRoot`, which owns the scroll
// progress (0 = hero top at viewport top, 1 = hero fully scrolled out) and
// shares it with `HeroBackdrop` (photo) and `HeroContent` (logo/title/CTA).
// Server-rendered children (next/image, i18n text, links) pass straight
// through. The torn edge is a sibling of both and never moves.
//
// Parallax only runs from `lg` up and when motion is allowed; otherwise the
// transforms are simply not applied (the markup stays identical).

/** How far the photo lags behind the scroll, as a fraction of the hero height. */
const BACKDROP_TRAVEL = 0.12;
/** The photo layer is this much taller than the hero, so it never shows a gap at the top. */
const BACKDROP_OVERSCAN_PCT = BACKDROP_TRAVEL * 100;
/** Content drift while the hero leaves (px, negative = up) and its end opacity. */
const CONTENT_DRIFT_PX = -40;
const CONTENT_MIN_OPACITY = 0.2;

interface HeroMotionState {
  progress: MotionValue<number>;
  enabled: boolean;
}

const HeroMotionContext = createContext<HeroMotionState | null>(null);

function useHeroMotion(): HeroMotionState {
  const state = useContext(HeroMotionContext);
  if (!state)
    throw new Error(
      "HeroBackdrop/HeroContent must be rendered inside HeroMotionRoot",
    );
  return state;
}

export function HeroMotionRoot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery(SITE_PIN_QUERY);
  const enabled = isDesktop && !reduced;

  const value = useMemo(
    () => ({ progress: scrollYProgress, enabled }),
    [scrollYProgress, enabled],
  );

  return (
    <HeroMotionContext.Provider value={value}>
      <section ref={ref} className={className}>
        {children}
      </section>
    </HeroMotionContext.Provider>
  );
}

/** Photo layer: 12% taller than the hero (extra on top), slides down 12% of the hero height. */
export function HeroBackdrop({ children }: { children: ReactNode }) {
  const { progress, enabled } = useHeroMotion();
  // Percentages are relative to the layer itself (112% of the hero).
  const travelPct = (BACKDROP_TRAVEL / (1 + BACKDROP_TRAVEL)) * 100;
  const y = useTransform(progress, [0, 1], ["0%", `${travelPct}%`]);

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 -z-20"
      style={{ top: `-${BACKDROP_OVERSCAN_PCT}%`, y: enabled ? y : 0 }}
    >
      {children}
    </motion.div>
  );
}

/** Content block: fades to 0.2 and drifts up 40px while the hero scrolls out. */
export function HeroContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { progress, enabled } = useHeroMotion();
  const opacity = useTransform(progress, [0, 0.75], [1, CONTENT_MIN_OPACITY]);
  const y = useTransform(progress, [0, 1], [0, CONTENT_DRIFT_PX]);

  return (
    <motion.div
      className={className}
      style={enabled ? { opacity, y } : undefined}
    >
      {children}
    </motion.div>
  );
}
