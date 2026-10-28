import { getPreviewText } from "@/lib/preview/messages";

import type { PreviewPlaceholderData } from "./types";

// Preview only (`adaptPage` with `preview: true`): stands where a section had too little data to be drawn (a draft:
// publish would have refused it). Names the section type and the missing fields so the editor knows why part of the
// page is absent. Non-blocking, solid colours, a dashed border, no shadow. Server component, editor-only copy.
export async function PreviewPlaceholder({ domId, sectionKey, missing }: PreviewPlaceholderData["props"] & { domId: string }) {
  const p = await getPreviewText();
  return (
    <section id={domId} data-preview-placeholder={sectionKey} aria-label={p("placeholderTitle")} className="mx-auto my-6 w-full max-w-[1368px] px-6 md:px-12">
      <div className="border-2 border-dashed border-site-line bg-white px-4 py-3 text-sm text-site-ink-strong">
        <p className="font-bold">
          {p("placeholderTitle")} <code className="text-xs font-semibold">{sectionKey}</code>
        </p>
        <p>{p("hints.placeholder", { fields: missing.join(", ") })}</p>
      </div>
    </section>
  );
}
