import { getPreviewText } from "@/lib/preview/messages";
import type { PreviewHintCode } from "@/components/sections/types";

// Editor-only note inside a section of a PREVIEW page ("No background image yet"). Non-blocking: it sits in the
// corner, takes no part in the layout flow and does not intercept clicks. Solid colours only (no shadow, no blur).
// Server component; the copy comes from `i18n/site/preview.*.json` (`hints.*`), never from the visitor messages.
export async function PreviewHint({ code }: { code: PreviewHintCode }) {
  const p = await getPreviewText();
  return (
    <p
      role="note"
      data-preview-hint={code}
      className="pointer-events-none absolute top-4 left-4 z-10 max-w-[calc(100%-2rem)] bg-site-neon px-2 py-0.5 text-xs font-semibold text-site-ink-strong"
    >
      {p(`hints.${code}`)}
    </p>
  );
}
