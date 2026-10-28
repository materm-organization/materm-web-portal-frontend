import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getPreviewText } from "@/lib/preview/messages";
import type { PreviewWarning } from "@/lib/preview/resolve";
import { warningMessageKey } from "@/lib/preview/warnings";

// Preview banner (PF-10, doc/08 §3.9). Server component; first child of <main> on a page rendered from a preview
// token, or (variant "elsewhere") on a published page while a preview session is open.
//  - FIXED at the top of the viewport and always on screen, so it never reaches the bottom nav bar. (`sticky` inside
//    <main> was tried first: it is pushed out of view once <main> ends above the footer on short pages.) An
//    `invisible` twin in the flow reserves its height so the hero is not covered.
//  - warnings sit under the bar (they scroll away with the page, so a long list never eats the screen).
//  - solid colours only (no shadow, no blur); focus uses `outline`.
//  - receives NO token: the exit link is a plain <a> (next/link would prefetch it and end the session).
interface PreviewBannerProps {
  variant: "preview" | "elsewhere";
  /** `variant="preview"`: backend warnings (`data.preview.warnings`) */
  warnings?: readonly PreviewWarning[];
  /** the page to leave to (exit link) / to go back to (`elsewhere`) */
  path: string;
}

export async function PreviewBanner({ variant, warnings = [], path }: PreviewBannerProps) {
  const t = await getTranslations("site.preview");
  const p = await getPreviewText(); // editor-only copy, not part of the messages every visitor downloads
  const exitHref = `/api/preview/exit?path=${encodeURIComponent(path)}`;

  const bar = (
    <>
      <span className="bg-site-ink-strong px-2 py-0.5 text-xs font-bold tracking-[0.12em] text-site-neon uppercase">{p("badge")}</span>
      <p className="min-w-0 flex-1 basis-60 text-sm font-semibold">{variant === "preview" ? t("banner") : p("elsewhere")}</p>
      {variant === "elsewhere" && (
        <a
          href={path}
          className="text-sm font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-ink-strong"
        >
          {p("backToPreview")}
        </a>
      )}
      <Button asChild variant="site" size="default" className="min-h-9 px-4 py-1.5 text-sm">
        <a href={exitHref}>{t("exit")}</a>
      </Button>
    </>
  );
  const barClass = "flex flex-wrap items-center gap-x-4 gap-y-2 bg-site-neon px-4 py-2 text-site-ink-strong sm:px-8";

  return (
    <>
      {/* the real bar: FIXED to the top of the viewport (never reaches the bottom nav) */}
      <div role="status" data-preview-banner={variant} className={`fixed inset-x-0 top-0 z-[55] ${barClass}`}>
        {bar}
      </div>
      {/* invisible twin in the flow: reserves the bar's height (it wraps on phones) so the hero is not covered */}
      <div aria-hidden="true" data-preview-banner-spacer className={`invisible ${barClass}`}>
        {bar}
      </div>
      {variant === "preview" && warnings.length > 0 && (
        <section aria-label={p("warningsTitle", { count: warnings.length })} data-preview-warnings className="bg-site-ink-strong px-4 py-3 text-white sm:px-8">
          <h2 className="mb-1 text-sm font-bold">{p("warningsTitle", { count: warnings.length })}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${w.path}-${i}`} data-warning-code={w.code}>
                {p(`warnings.${warningMessageKey(w.code)}`)}
                {w.path && (
                  <>
                    {" "}
                    <code className="text-xs text-site-mist">{p("warningAt", { path: w.path })}</code>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
