import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CtaLink } from "@/components/site/cta-link";
import { PageHero } from "@/components/site/page-hero";
import { getPreviewText } from "@/lib/preview/messages";

// Where the preview flow ends when there is nothing to show (PF-10): expired / invalid link (`site.preview.expired`),
// no backend (bundle mode), rate limit, backend down. `/api/preview` and `/api/preview/exit` redirect here with
// `?s=<state>`; the page never receives a token and never says WHY a link was refused. Always noindex.
// Reserved path: a CMS page cannot use `/preview-status` (this more specific route wins over the catch-all).
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATES = ["expired", "unsupported", "busy", "unavailable"] as const;
type State = (typeof STATES)[number];

export default async function PreviewStatusPage({ searchParams }: { searchParams: Promise<{ s?: string | string[] }> }) {
  const raw = (await searchParams).s;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const state: State = (STATES as readonly string[]).includes(value ?? "") ? (value as State) : "expired";
  const site = await getTranslations("site");
  const p = await getPreviewText();

  const copy =
    state === "expired"
      ? { title: p("status.expiredTitle"), description: site("preview.expired") }
      : { title: p(`status.${state}Title`), description: p(`status.${state}Description`) };

  return (
    <PageHero variant="brand" image="/images/site/hero-forest-stream.jpg" imageAlt="" title={copy.title} showLogo={false}>
      {/* not PageHero's `description`: that one is CSS-capitalised, which would mangle `CMS_MODE=api` */}
      <p className="mx-auto mb-8 max-w-[933px] px-4 text-sm text-white sm:mb-10">{copy.description}</p>
      <CtaLink href="/" className="sm:w-[294px]">
        {p("status.action")}
      </CtaLink>
    </PageHero>
  );
}
