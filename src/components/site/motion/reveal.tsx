"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useInView } from "motion/react";

import { cn } from "@/lib/utils";

type RevealTag =
  | "div"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "span"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "li"
  | "figure";

interface RevealProps {
  as?: RevealTag;
  /** DOM id of the element (section anchors / `aria-labelledby` targets). */
  id?: string;
  /** Seconds. Use `revealDelay(i)` to stagger siblings. */
  delay?: number;
  /** Start offset in px (translateY). Default 24. */
  y?: number;
  /** Reveal only the first time it enters the viewport (default true). */
  once?: boolean;
  className?: string;
  children?: ReactNode;
}

// Fade + translateY when the element enters the viewport (10% inset).
// The hidden state and the transition live in CSS (`.site-reveal` in
// globals.css) and only apply under `prefers-reduced-motion: no-preference`,
// so with reduced motion the content is simply visible, and the server HTML
// matches the client (no hydration mismatch).
export function Reveal({
  as = "div",
  id,
  delay = 0,
  y = 24,
  once = true,
  className,
  children,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, margin: "-10% 0px" });

  const Tag = as as "div";

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      id={id}
      className={cn("site-reveal", className)}
      data-revealed={inView ? "true" : "false"}
      style={
        {
          "--reveal-y": `${y}px`,
          "--reveal-delay": `${delay}s`,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
