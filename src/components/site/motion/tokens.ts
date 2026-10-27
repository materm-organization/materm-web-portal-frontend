// Motion tokens for the public site (Figma prototype: EASE_OUT, smart animate).
// CSS twin of SITE_EASE_OUT lives in globals.css (`--ease-site-out`).

/** Figma EASE_OUT, close to CSS `ease-out`: cubic-bezier(0, 0, 0.2, 1). */
export const SITE_EASE_OUT = [0, 0, 0.2, 1] as const;

/** `SITE_EASE_OUT` as a CSS timing function string. */
export const SITE_EASE_OUT_CSS = "cubic-bezier(0, 0, 0.2, 1)";

/** Durations in seconds (Figma reactions). */
export const SITE_DURATION = {
  /** Button hover (Default -> hover). */
  button: 0.4,
  /** Gallery card hover caption. */
  card: 0.3,
  /** Hero content in (Frame 6 -> Frame 7). */
  hero: 0.8,
  /** Headings / paragraphs / eyebrows reveal. */
  reveal: 0.6,
} as const;

/** Tailwind `lg` (1024px): below it nothing is pinned. */
export const SITE_PIN_QUERY = "(min-width: 1024px)";

/**
 * Stagger helper: `delay={revealDelay(index)}` -> 0, 0.12, 0.24 ... seconds.
 * Lives here (no "use client") on purpose: Server Components call it, and a
 * function exported from a client module cannot be invoked on the server.
 */
export const revealDelay = (index: number, step = 0.12) => index * step;
