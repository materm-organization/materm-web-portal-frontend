"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";

import { useMediaQuery } from "./use-media-query";
import { SITE_PIN_QUERY } from "./tokens";

interface ScrollSceneProps {
  /** Extra scroll distance in vh while pinned (wrapper = lengthVh + 100vh). */
  lengthVh: number;
  /** Render prop receiving scroll progress 0 -> 1 (a stable MotionValue). */
  children: (progress: MotionValue<number>) => ReactNode;
  /** Classes for the wrapper (the tall scroll track). */
  className?: string;
  /** Classes for the inner node (sticky when pinned, plain otherwise). */
  stickyClassName?: string;
  /** Extra classes only when NOT pinned (mobile / reduced motion). */
  staticClassName?: string;
  /** Sticky `top` offset in px, e.g. the fixed header height. Default 0. */
  top?: number;
  /** Clip the pinned viewport (default true). */
  overflowHidden?: boolean;
  /** Progress passed to children when not pinned (default 0). */
  staticProgress?: number;
}

// Pins its content for `lengthVh` of scrolling and exposes the scroll
// progress. Pins only at `lg`+ with motion allowed; otherwise renders the same
// tree in a plain container with `progress` fixed at `staticProgress`.
export function ScrollScene({
  lengthVh,
  children,
  className,
  stickyClassName,
  staticClassName,
  top = 0,
  overflowHidden = true,
  staticProgress = 0,
}: ScrollSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery(SITE_PIN_QUERY);
  const reduced = useReducedMotion();
  // false on the server + first client render, so SSR markup is the static one.
  const pinned = isDesktop && !reduced;

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });
  const smooth = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // One stable MotionValue for children, whichever mode we are in.
  const progress = useMotionValue(staticProgress);
  useMotionValueEvent(smooth, "change", (v) => {
    if (pinned) progress.set(v);
  });
  useEffect(() => {
    progress.set(pinned ? smooth.get() : staticProgress);
  }, [pinned, staticProgress, progress, smooth]);

  return (
    <div
      ref={wrapperRef}
      data-pinned={pinned ? "true" : "false"}
      className={cn("relative", className)}
      style={pinned ? { height: `calc(${lengthVh}vh + 100vh)` } : undefined}
    >
      <div
        className={cn(
          pinned
            ? cn("sticky", overflowHidden && "overflow-hidden")
            : cn("relative", staticClassName),
          stickyClassName,
        )}
        style={pinned ? { top, height: `calc(100vh - ${top}px)` } : undefined}
      >
        {children(progress)}
      </div>
    </div>
  );
}
