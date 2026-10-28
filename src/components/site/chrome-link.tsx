import Link from "next/link";
import type { ComponentProps } from "react";

import type { ChromeLink } from "@/lib/cms/site-chrome";

type AnchorProps = Omit<ComponentProps<"a">, "href" | "target" | "rel" | "children">;

/**
 * A menu link from the CMS: `next/link` for site paths, a plain `<a>` for http(s) / mailto / tel.
 * `target` / `rel` come from the menu item (noopener noreferrer whenever it opens a new tab).
 * No hooks and no "use client": usable from Server and Client Components.
 */
export function ChromeAnchor({ link, children, ...props }: AnchorProps & { link: ChromeLink; children: React.ReactNode }) {
  const common = {
    ...props,
    ...(link.ariaLabel && !props["aria-label"] ? { "aria-label": link.ariaLabel } : {}),
    ...(link.newTab ? { target: "_blank" as const } : {}),
    ...(link.rel ? { rel: link.rel } : {}),
  };
  if (link.external) {
    return (
      <a href={link.href} {...common}>
        {children}
      </a>
    );
  }
  return (
    <Link href={link.href} {...common}>
      {children}
    </Link>
  );
}
