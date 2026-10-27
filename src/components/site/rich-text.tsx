import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import { ctaLinkProps } from "@/components/sections/cta";
import type { RichTextDoc, RichTextNode } from "@/components/sections/types";
import { Reveal, revealDelay } from "@/components/site/motion";
import { cn } from "@/lib/utils";

// Rich text renderer (doc/08 §3.13, PF-11): a Server Component that maps a single-locale
// ProseMirror-style doc (profile `lite`: paragraph, lists, hardBreak, bold, italic, link; plus the
// `full` text nodes `lead`, `heading` 2-3 and `blockquote`) to React elements.
//  - NEVER `dangerouslySetInnerHTML`: only elements built here are rendered, text stays text.
//  - Unknown nodes are skipped but their text is kept (a block we do not know becomes a paragraph),
//    unknown marks are ignored. `image` / `embed` (profile `full`) are not rendered yet.
//  - Links are untrusted data: only `/path`, `http(s):`, `mailto:` and `tel:` survive; anything else
//    (`javascript:`, `data:`, `//host`) is dropped and the text is rendered plain. `target=_blank` gets
//    `rel="noopener noreferrer"` through the same `ctaLinkProps` rules the CTA buttons use.
//  - The component renders a FRAGMENT: the caller keeps its own wrapper (flex gap, spacing).
//    One paragraph = one `<Reveal as="p">` (replaces the old `paragraphCount`). Visual output of a
//    plain-text paragraph equals the pre-CMS `<Reveal as="p">{text}</Reveal>`.

export interface RichTextProps {
  doc: RichTextDoc | null | undefined;
  /** Classes of every `paragraph` (and of a `lead` when `leadClassName` is not given). */
  paragraphClassName?: string;
  /** Classes of the `lead` (standfirst) node. */
  leadClassName?: string;
  /** Stagger of the block with this (visible) index. Default `revealDelay(index)`. */
  delay?: (index: number) => number;
  /** false = plain `<p>`s without the fade-up (e.g. inside an accordion). Default true. */
  reveal?: boolean;
  /** A doc with exactly one paragraph renders as bare inline content, with no `<p>` (FAQ answers). */
  unwrapSingle?: boolean;
}

const LINK_CLASS =
  "underline underline-offset-2 hover:text-site-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-700";

const SAFE_HREF = /^(?:\/(?!\/)|https?:\/\/|mailto:|tel:)/i;

function plainText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join("");
}

function attrString(attrs: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const v = attrs?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function renderText(node: RichTextNode, key: string): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "link") {
      const href = attrString(mark.attrs, "href");
      if (!href || !SAFE_HREF.test(href)) continue;
      const props = ctaLinkProps({ label: "", href, openInNewTab: attrString(mark.attrs, "target") === "_blank" });
      if (!props) continue;
      out = href.startsWith("/") ? (
        <Link href={props.href} target={props.target} rel={props.rel} className={LINK_CLASS}>
          {out}
        </Link>
      ) : (
        <a href={props.href} target={props.target} rel={props.rel} className={LINK_CLASS}>
          {out}
        </a>
      );
    }
  }
  return <Fragment key={key}>{out}</Fragment>;
}

function renderInline(nodes: readonly RichTextNode[] | undefined, path: string): ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    const key = `${path}.${i}`;
    if (node.type === "text") return renderText(node, key);
    if (node.type === "hardBreak") return <br key={key} />;
    // Unknown inline/wrapper node: keep what is inside it.
    return <Fragment key={key}>{renderInline(node.content, key)}</Fragment>;
  });
}

function renderListItems(node: RichTextNode, path: string): ReactNode[] {
  return (node.content ?? []).map((item, i) => (
    <li key={i}>
      {(item.content ?? []).map((child, j) => {
        const key = `${path}.${i}.${j}`;
        if (child.type === "bulletList" || child.type === "orderedList") {
          const Tag = child.type === "orderedList" ? "ol" : "ul";
          return (
            <Tag key={j} className={child.type === "orderedList" ? "list-decimal pl-6" : "list-disc pl-6"}>
              {renderListItems(child, key)}
            </Tag>
          );
        }
        return <Fragment key={j}>{renderInline(child.type === "paragraph" ? child.content : [child], key)}</Fragment>;
      })}
    </li>
  ));
}

export function RichText({
  doc,
  paragraphClassName,
  leadClassName,
  delay = revealDelay,
  reveal = true,
  unwrapSingle = false,
}: RichTextProps) {
  const blocks = (doc?.content ?? []).filter((block) => plainText(block).trim() !== "" || block.type === "bulletList" || block.type === "orderedList");
  if (blocks.length === 0) return null;

  if (unwrapSingle && blocks.length === 1 && blocks[0].type === "paragraph") {
    return <>{renderInline(blocks[0].content, "0")}</>;
  }

  return (
    <>
      {blocks.map((block, index) => {
        const path = String(index);
        const lead = block.type === "lead";
        const className = lead ? (leadClassName ?? paragraphClassName) : paragraphClassName;
        const wrap = (as: "p" | "h2" | "h3" | "ul" | "ol" | "div", cls: string | undefined, children: ReactNode) => {
          if (reveal) {
            return (
              <Reveal as={as} key={index} delay={delay(index)} className={cls}>
                {children}
              </Reveal>
            );
          }
          const Tag = as;
          return (
            <Tag key={index} className={cls}>
              {children}
            </Tag>
          );
        };

        if (block.type === "bulletList" || block.type === "orderedList") {
          const ordered = block.type === "orderedList";
          return wrap(ordered ? "ol" : "ul", cn(ordered ? "list-decimal pl-6" : "list-disc pl-6", className), renderListItems(block, path));
        }
        if (block.type === "heading") {
          const level = Number(block.attrs?.level) === 3 ? "h3" : "h2";
          return wrap(level, cn("font-bold", className), renderInline(block.content, path));
        }
        if (block.type === "blockquote") {
          return wrap("div", cn("border-l-4 border-site-line pl-4 italic", className), renderInline(block.content?.flatMap((c) => (c.type === "paragraph" ? (c.content ?? []) : [c])), path));
        }
        // paragraph, lead and every unknown block: a paragraph of its text
        return wrap("p", className, renderInline(block.content, path));
      })}
    </>
  );
}
