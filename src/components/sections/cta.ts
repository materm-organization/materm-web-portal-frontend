import type { ResolvedLink } from "./types";

/**
 * Link props for a resolved CTA (`CtaLink` takes next/link props). `null` when the target is
 * not published (`href: null`) or there is no CTA: the caller renders nothing (doc/04 section 6.3).
 * `noopener noreferrer` is added whenever the link opens a new tab (doc/04 section 3.1).
 */
export function ctaLinkProps(
  link: ResolvedLink | null | undefined,
): { href: string; label: string; target?: "_blank"; rel?: string } | null {
  if (!link || !link.href) return null;
  const rel = [...(link.rel ?? []), ...(link.openInNewTab ? ["noopener", "noreferrer"] : [])];
  return {
    href: link.href,
    label: link.label,
    ...(link.openInNewTab ? { target: "_blank" as const } : {}),
    ...(rel.length > 0 ? { rel: [...new Set(rel)].join(" ") } : {}),
  };
}
