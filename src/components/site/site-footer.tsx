import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import { SITE_FOOTER_NAV_ITEMS } from "@/components/site/nav-items";
import { Button } from "@/components/ui/button";

const SOCIAL_LINKS = [
  { key: "instagram", href: "https://www.instagram.com/", icon: "/images/site/icon-instagram.svg" },
  { key: "youtube", href: "https://www.youtube.com/", icon: "/images/site/icon-youtube.svg" },
  { key: "facebook", href: "https://www.facebook.com/", icon: "/images/site/icon-facebook.svg" },
  { key: "twitter", href: "https://twitter.com/", icon: "/images/site/icon-twitter.svg" },
] as const;

// Green mountain-silhouette footer. The top slice of the Figma "Organic footer
// field" SVG (1728x464) forms the torn top edge; solid green continues below.
// Social URLs are placeholders (the design carries no real handles).
//
// `lg`+ is the Figma layout (brand left, links right, copyright + social on the
// last row). Below `lg` everything is a centred stack: emblem, wordmark and
// statement; a hairline; the links as a 2x2 list (one row of four from `sm`);
// then the social buttons and, last, the copyright.
export function SiteFooter() {
  const t = useTranslations("site");

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
                alt={t("footer.emblemAlt")}
                width={78}
                height={65}
                className="h-auto w-24 shrink-0 lg:w-[78px]"
              />
              <div className="flex max-w-[400px] flex-col items-center gap-3 lg:items-start lg:gap-6">
                <p className="font-site-display text-[32px] leading-none lg:text-[28px]">{t("brand")}</p>
                <p className="max-w-[34ch] font-site-manrope text-[15px] leading-[1.7] text-balance text-site-mist lg:max-w-none lg:text-sm lg:leading-[1.6] lg:text-pretty">
                  {t("footer.statement")}
                </p>
              </div>
            </div>

            <nav
              aria-label={t("footer.navLabel")}
              className="w-full max-lg:border-t max-lg:border-white/15 max-lg:pt-3 lg:w-auto"
            >
              <ul className="mx-auto grid w-full max-w-[320px] grid-cols-2 gap-x-6 text-base leading-[1.2] font-extrabold text-site-mist sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-x-10 sm:gap-y-3 lg:w-[370px] lg:justify-between lg:gap-x-0">
                {SITE_FOOTER_NAV_ITEMS.map((item) => (
                  <li key={item.href} className="border-b border-white/10 sm:border-0 [&:nth-last-child(-n+2)]:border-b-0">
                    <Link
                      href={item.href}
                      className="flex min-h-12 items-center gap-3 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-0"
                    >
                      <span aria-hidden="true" className="h-px w-3.5 shrink-0 bg-site-mist sm:hidden" />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col-reverse items-center gap-6 border-t border-white/15 pt-8 text-center sm:flex-row sm:justify-between sm:text-left lg:border-t-0 lg:pt-0">
            <p className="max-w-[30ch] font-site-manrope text-xs leading-[1.6] text-balance text-site-mist sm:max-w-none sm:text-[13px] sm:text-pretty">
              {t("footer.copyright")}
            </p>
            <ul aria-label={t("footer.socialLabel")} className="flex justify-center gap-4">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.key}>
                  <Button
                    asChild
                    variant="site-icon"
                    size="site-icon"
                    className="max-lg:size-11 max-lg:bg-white/10 max-lg:hover:bg-white/20"
                  >
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t(`footer.social.${social.key}`)}
                    >
                      <Image src={social.icon} alt="" width={16} height={16} className="max-lg:size-5" />
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
