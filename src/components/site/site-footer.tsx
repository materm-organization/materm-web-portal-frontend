import { useTranslations } from "next-intl";
import Image from "@/components/site/site-image";

import { ChromeAnchor } from "@/components/site/chrome-link";
import { Button } from "@/components/ui/button";
import type { ChromeLink, SiteChrome } from "@/lib/cms/site-chrome";

// Icon files we ship (`public/images/site/icon-<icon>.svg`). A social menu item (menu `social`, item `icon`)
// with another icon name is not rendered: there is no artwork for it yet.
const SOCIAL_ICONS = new Set(["instagram", "youtube", "facebook", "twitter"]);
const socialIcon = (link: ChromeLink): string | null => (link.icon && SOCIAL_ICONS.has(link.icon) ? `/images/site/icon-${link.icon}.svg` : null);

// Green mountain-silhouette footer. The top slice of the Figma "Organic footer
// field" SVG (1728x464) forms the torn top edge; solid green continues below.
// Everything that is content comes from the CMS site bundle (P-05) through `chrome`: brand name, statement,
// emblem alt and copyright (settings `brand.*` / `footer.*`), the footer menu and the social menu. The social
// URLs in the bundled seed are placeholders (the design carries no real handles).
//
// `lg`+ is the Figma layout (brand left, links right, copyright + social on the
// last row). Below `lg` everything is a centred stack: emblem, wordmark and
// statement; a hairline; the links as a 2x2 list (one row of four from `sm`);
// then the social buttons and, last, the copyright.
export function SiteFooter({ chrome }: { chrome: Pick<SiteChrome, "brand" | "footerNav" | "social"> }) {
  const t = useTranslations("site");
  const { brand, footerNav, social } = chrome;

  return (
    <footer className="relative text-white">
      <div data-slot="footer-ridge" aria-hidden="true" className="relative h-[clamp(5.5rem,11.6vw,200px)] w-full">
        <Image
          src="/images/site/footer-mountains.svg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-top"
        />
      </div>

      <div className="-mt-px bg-site-green-900 px-6 pt-4 pb-12 md:px-12">
        <div className="mx-auto flex w-full max-w-[1633px] flex-col gap-8">
          <div className="flex flex-col items-center gap-9 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:gap-[38px] lg:text-left">
              <Image
                src="/images/site/materm-emblem.svg"
                alt={brand.emblemAlt}
                onFailure="remove"
                width={78}
                height={65}
                className="h-auto w-24 shrink-0 lg:w-[78px]"
              />
              <div className="flex max-w-[400px] flex-col items-center gap-3 lg:items-start lg:gap-6">
                <p className="font-site-display text-[32px] leading-none lg:text-[28px]">{brand.name}</p>
                <p className="max-w-[34ch] font-site-manrope text-[15px] leading-[1.7] text-balance text-site-mist lg:max-w-none lg:text-sm lg:leading-[1.6] lg:text-pretty">
                  {brand.statement}
                </p>
              </div>
            </div>

            <nav
              aria-label={t("footer.navLabel")}
              className="w-full max-lg:border-t max-lg:border-white/15 max-lg:pt-3 lg:w-auto"
            >
              <ul className="mx-auto grid w-full max-w-[320px] grid-cols-2 gap-x-6 text-base leading-[1.2] font-extrabold text-site-mist sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-x-10 sm:gap-y-3 lg:w-[370px] lg:justify-between lg:gap-x-0">
                {footerNav.map((item, index) => (
                  <li key={`${item.href}-${index}`} className="border-b border-white/10 sm:border-0 [&:nth-last-child(-n+2)]:border-b-0">
                    <ChromeAnchor
                      link={item}
                      className="flex min-h-12 items-center gap-3 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-0"
                    >
                      <span aria-hidden="true" className="h-px w-3.5 shrink-0 bg-site-mist sm:hidden" />
                      {item.label}
                    </ChromeAnchor>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col-reverse items-center gap-6 border-t border-white/15 pt-8 text-center sm:flex-row sm:justify-between sm:text-left lg:border-t-0 lg:pt-0">
            <p className="max-w-[30ch] font-site-manrope text-xs leading-[1.6] text-balance text-site-mist sm:max-w-none sm:text-[13px] sm:text-pretty">
              {brand.copyright}
            </p>
            {social.length > 0 && (
              <ul aria-label={t("footer.socialLabel")} className="flex justify-center gap-4">
                {social.map((item, index) => {
                  const icon = socialIcon(item);
                  if (!icon) return null;
                  return (
                    <li key={`${item.href}-${index}`}>
                      <Button
                        asChild
                        variant="site-icon"
                        size="site-icon"
                        className="max-lg:size-11 max-lg:bg-white/10 max-lg:hover:bg-white/20"
                      >
                        <a
                          href={item.href}
                          target="_blank"
                          rel={item.rel ?? "noopener noreferrer"}
                          aria-label={item.ariaLabel ?? item.label}
                        >
                          <Image src={icon} alt="" width={16} height={16} className="max-lg:size-5" />
                        </a>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
