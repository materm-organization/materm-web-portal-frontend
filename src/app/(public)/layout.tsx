import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

// Page titles come from each page's metadata and render as "<title> | Materm".
export const metadata: Metadata = {
  title: { default: "Materm", template: "%s | Materm" },
  description: "Materm - treehouse and camping at Phou Khao Khouay, Laos.",
};

// Public marketing site shell (`/`, `/our-path`, `/blog`, `/blog/[slug]`,
// `/gallery`). The `.site` wrapper (globals.css) scopes the site's fonts and
// light canvas, so nothing here leaks into the admin look.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("site");

  return (
    <div className="site flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-site-green-900 focus:px-4 focus:py-2 focus:text-white"
      >
        {t("skipToContent")}
      </a>
      {/* Scroll-reveal text starts transparent in CSS and is revealed by JS; without JS it must still show. */}
      <noscript>
        <style>{".site-reveal{opacity:1 !important;transform:none !important;transition:none !important}"}</style>
      </noscript>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {/* The nav bar is fixed to the bottom of the viewport; this spacer extends the footer's
          green below its last row so the bar never covers the copyright/social row, while
          the green still reaches the page's bottom edge. Keep the colour in sync with
          `SiteFooter`'s content background. */}
      <div
        aria-hidden="true"
        className="h-[calc(4rem+env(safe-area-inset-bottom))] bg-site-green-900"
      />
    </div>
  );
}
