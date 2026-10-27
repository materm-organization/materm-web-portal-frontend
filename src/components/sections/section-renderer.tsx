import { Fragment, type ComponentType, type ReactNode } from "react";

import { pageDomIds } from "./dom-id";
import { FRAMES, getSectionEntry, type FrameName } from "./registry";
import type { SectionChrome, SectionData } from "./types";

// Renders the sections of a page in order (doc/08 section 4.3):
//  1. every section (or frame wrapper) is a DIRECT child of <main>: the footer ridge selector in
//     globals.css is `.site:has(main > [data-footer-backdrop="soft"]:last-child)`;
//  2. the LAST section gets `footerBackdrop="soft"` when its (effective) variant is `soft`;
//  3. adjacent sections with the same registry `frame` are merged into one wrapper;
//  4. DOM ids come from `anchor_id ?? "s-" + public_id` (duplicates get -2, -3...);
//  5. only the first section gets `priority` (hero image preload);
//  6. an unknown key / unsupported version renders nothing and is logged once (dev only).

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (process.env.NODE_ENV === "production" || warned.has(message)) return;
  warned.add(message);
  console.warn(`[sections] ${message}`);
}

// Components are typed per section key; the renderer dispatches on a runtime string, so it
// hands every component the same loose bag of props.
type AnyComponent = ComponentType<SectionChrome & Record<string, unknown>>;

interface Item {
  node: ReactNode;
  frame?: FrameName;
  key: string;
}

export function SectionRenderer({ sections }: { sections: readonly SectionData[] }) {
  const domIds = pageDomIds(sections, (anchorId, resolved) =>
    warnOnce(`duplicate section id "${anchorId}" on one page, using "${resolved}"`),
  );

  // Resolve registry entries first so "last" and "first" refer to what is actually rendered.
  const visible = sections.flatMap((section, index) => {
    const entry = getSectionEntry(section.key);
    if (!entry) {
      warnOnce(`unknown section key "${section.key}" skipped`);
      return [];
    }
    if (!entry.versions.includes(section.version)) {
      warnOnce(`section "${section.key}" version ${section.version} is not supported, skipped`);
      return [];
    }
    return [{ section, entry, domId: domIds[index] }];
  });

  const items: Item[] = visible.map(({ section, entry, domId }, index) => {
    const variant = section.variant ?? entry.variants[0] ?? null;
    if (variant !== null && entry.variants.length > 0 && !entry.variants.includes(variant)) {
      warnOnce(`section "${section.key}" has unknown variant "${variant}"`);
    }
    const isLast = index === visible.length - 1;
    const Component = entry.component as unknown as AnyComponent;
    return {
      key: section.id,
      frame: entry.frame,
      node: (
        <Component
          {...(section.props as object)}
          domId={domId}
          variant={variant}
          footerBackdrop={isLast && variant === "soft" && !entry.frame ? "soft" : undefined}
          priority={index === 0}
        />
      ),
    };
  });

  // Merge runs of the same frame.
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length; ) {
    const { frame } = items[i];
    if (!frame) {
      out.push(<Fragment key={items[i].key}>{items[i].node}</Fragment>);
      i += 1;
      continue;
    }
    const run: Item[] = [];
    while (i < items.length && items[i].frame === frame) run.push(items[i++]);
    out.push(
      <div key={`frame-${run[0].key}`} className={FRAMES[frame]}>
        {run.map((item) => (
          <Fragment key={item.key}>{item.node}</Fragment>
        ))}
      </div>,
    );
  }

  return <>{out}</>;
}
