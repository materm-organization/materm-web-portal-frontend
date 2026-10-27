"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { PageHero } from "@/components/site/page-hero";
import { Button } from "@/components/ui/button";

// Error boundary of the public site (doc/08 §3.8). Only a render bug lands here: an unreachable CMS API is
// absorbed earlier by the bundled fallback, and a section that cannot be drawn is skipped by `adaptPage`.
// Strings: `site.error.*`. `retry` re-fetches and re-renders (Next 16.3); `reset` is the older name.
export default function PublicError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const t = useTranslations("site.error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageHero
      variant="brand"
      image="/images/site/hero-forest-stream.jpg"
      imageAlt=""
      title={t("title")}
      description={t("description")}
      showLogo={false}
    >
      <Button variant="site" size="site" type="button" className="sm:w-[294px]" onClick={() => (retry ?? reset)?.()}>
        {t("retry")}
      </Button>
    </PageHero>
  );
}
