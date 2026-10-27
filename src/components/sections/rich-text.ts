import type { RichTextDoc, RichTextNode } from "./types";

// Minimal single-locale rich text (profile `lite`) -> paragraphs of plain text. The shared
// `RichText` renderer (links, bold...) is T1.2.9 / PF-11; until then a paragraph is the text of
// its leaves, with `hardBreak` as a newline. Pure: usable from Server Components and adapters.

function nodeText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(nodeText).join("");
}

/** One string per top-level block (paragraph, list...) of the doc; empty blocks are dropped. */
export function richTextParagraphs(doc: RichTextDoc | null | undefined): string[] {
  return (doc?.content ?? []).map(nodeText).filter((text) => text.trim() !== "");
}

/** Build a `lite` doc from plain paragraphs (used by the fixture adapters). */
export function paragraphsToDoc(paragraphs: readonly string[]): RichTextDoc {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}
