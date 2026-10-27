import { TORN_EDGE_PATHS } from "@/components/site/torn-edge-paths";
import { cn } from "@/lib/utils";

interface TornEdgeProps {
  /**
   * Which edge of the parent it clings to. `bottom` (default) is the white
   * jagged edge under a hero; `top` mirrors it vertically so the torn side
   * faces down (for a white band hanging from the top of a dark section).
   * The parent must be `relative`.
   */
  position?: "bottom" | "top";
  /** `tall` = Home / Our Path hero (1728x159), `short` = article / gallery hero (1728x85). */
  variant?: "tall" | "short";
  className?: string;
}

// Fill follows `text-*` (default white) via currentColor, so it can match the
// section below it. Purely decorative -> aria-hidden.
export function TornEdge({ position = "bottom", variant = "tall", className }: TornEdgeProps) {
  const { width, height, d } = TORN_EDGE_PATHS[variant];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-x-0 block w-full text-white",
        variant === "tall"
          ? "h-[clamp(3rem,9.2vw,159px)]"
          : "h-[clamp(2rem,4.9vw,85px)]",
        position === "bottom" ? "-bottom-px" : "-top-px -scale-y-100",
        className
      )}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
