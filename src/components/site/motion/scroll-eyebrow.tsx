"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import { cn } from "@/lib/utils";

// Section eyebrow (green bar + spaced label) that GROWS with the scroll, like
// the Figma prototype: the bar starts as the 14px tick and stretches until it
// reaches the label at the far end of the row (Figma component sets "Component
// 12/14/20": tick state `Frame 26/29` <-> long-bar state `Frame 20/22/23`).
//
// Scrubbed by scroll position, not timed: progress is 0 when the row's top is
// at 92% of the viewport height and 1 at 38%, i.e. the bar finishes growing
// about half a screen of scrolling later (the "longer" feel), and it shrinks
// back when scrolling up. Under `prefers-reduced-motion` it stays the tick.
//
// The bar is a flex item whose `flex-grow` goes 0 -> 1 on a fixed tick basis:
// with a single grower and a total grow factor <= 1, the bar takes exactly
// `grow x free space`, so its width interpolates linearly from the tick to
// "row width - gap - label width" with no measurement.

const SPRING = { stiffness: 120, damping: 30, restDelta: 0.001 } as const;

export function ScrollEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 92%", "start 38%"],
  });
  const smooth = useSpring(scrollYProgress, SPRING);
  const grow = useTransform(smooth, (p) => (reduced ? 0 : Math.min(1, Math.max(0, p))));

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-4 [--eyebrow-tick:0.75rem] sm:gap-6 sm:[--eyebrow-tick:0.875rem]",
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className="self-stretch bg-site-green-600"
        style={{
          flexGrow: grow,
          flexShrink: 0,
          flexBasis: "var(--eyebrow-tick)",
        }}
      />
      {children}
    </div>
  );
}
