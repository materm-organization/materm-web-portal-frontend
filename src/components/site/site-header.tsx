"use client";

import { ChevronUpIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ChromeAnchor } from "@/components/site/chrome-link";
import { TORN_EDGE_PATHS } from "@/components/site/torn-edge-paths";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSwitchLocale } from "@/components/global/language-switcher";
import { isActiveLink, type ChromeLanguage, type SiteChrome } from "@/lib/cms/site-chrome";
import { cn } from "@/lib/utils";

// Site navigation bar, fixed at the BOTTOM of the viewport ("Mountain edge" design).
//
// md+ is a copy of `site-header.tsx` (the Figma floating bar), untouched.
// Below `md` the bar is a full-bleed dark-green band glued to the bottom of the
// viewport. Its TOP edge is the same jagged silhouette family as the footer
// (the Figma "short" torn-edge path: solid below, ragged above), so the page
// shows through the notches like a ridge line. The bottom Sheet repeats the
// silhouette along its top edge, so the menu feels like the footer rising.
const SILHOUETTE = TORN_EDGE_PATHS.short;

// The brand link of the md+ bar always goes to the home page (it is visually hidden until focused).
const HOME_LINK = { href: "/", label: "", ariaLabel: null, match: "exact", external: false, newTab: false, rel: undefined, icon: null } as const;

// Decorative ridge strip. Drawn at the footer's own scale (the footer maps the
// 1728-wide artwork to the viewport width), i.e. height = 85/1728 * width,
// clamped to 14-20 px; the path is a vector with `fill=currentColor`, so it is
// crisp at any DPR and takes its colour from `text-site-nav`.
function MountainSilhouette({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${SILHOUETTE.width} ${SILHOUETTE.height}`}
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none block h-[clamp(14px,4.9vw,20px)] w-full text-site-nav",
        className
      )}
    >
      <path d={SILHOUETTE.d} fill="currentColor" />
    </svg>
  );
}

function LanguageToggle({
  locale,
  label,
  languages,
  onSwitch,
  itemClassName,
  className,
}: {
  locale: string;
  label: string;
  languages: ChromeLanguage[];
  onSwitch: (code: string) => void;
  itemClassName: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={locale}
      aria-label={label}
      className={cn("rounded-none", className)}
      onValueChange={(value) => {
        // Radix emits "" when the active item is clicked again — ignore.
        if (value && value !== locale && languages.some((l) => l.code === value)) onSwitch(value);
      }}
    >
      {languages.map((option) => (
        <ToggleGroupItem
          key={option.code}
          value={option.code}
          className={cn(
            "rounded-none font-site-manrope text-xs font-semibold tracking-wider text-site-mist hover:bg-white/10 hover:text-white",
            "focus-visible:outline-white data-[state=on]:bg-site-nav-chip data-[state=on]:font-bold data-[state=on]:text-site-neon data-[state=on]:hover:bg-site-nav-chip data-[state=on]:hover:text-site-neon",
            itemClassName
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// `chrome` = menus, brand and languages from the CMS site bundle (P-05), built on the server by
// `buildSiteChrome` (menu items without a published target are already gone, the languages are the ones
// the API returned).
export function SiteHeader({ chrome }: { chrome: Pick<SiteChrome, "nav" | "languages" | "brand"> }) {
  const t = useTranslations("site");
  const pathname = usePathname();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const { switchTo } = useSwitchLocale();
  const { nav, languages, brand } = chrome;
  const currentItem = nav.find((item) => isActiveLink(pathname, item));
  // Unknown routes (404) fall back to the generic "Menu" label.
  const currentLabel = currentItem ? currentItem.label : t("nav.menuTitle");
  const showLanguages = languages.length > 1;

  return (
    <header className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center md:px-4 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto relative w-full bg-site-nav text-white ease-out motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 md:flex md:max-w-[1000px] md:items-center md:justify-between md:gap-4 md:px-6 md:py-3">
        {/* Mobile / tablet (< md): ridge line above a full-bleed band. The strip sits
            OUTSIDE the band (bottom-full) and is pointer-events-none, so its notches
            never block taps on the page. */}
        <MountainSilhouette className="absolute inset-x-0 bottom-[calc(100%-1px)] md:hidden" />

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <div className="flex items-center justify-between gap-2 px-4 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden">
            {/* Left cluster (emblem + page name) is a big tap target that opens the menu. */}
            <SheetTrigger
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={t("nav.currentPage", { page: currentLabel })}
            >
              <Image
                src="/images/site/materm-emblem.svg"
                alt=""
                width={78}
                height={65}
                className="h-7 w-auto shrink-0"
              />
              <span className="min-w-0 truncate font-site-display text-lg leading-none uppercase">
                {currentLabel}
              </span>
            </SheetTrigger>

            <div className="flex shrink-0 items-center gap-2">
              {showLanguages && (
                <LanguageToggle
                  locale={locale}
                  label={t("language.label")}
                  languages={languages}
                  onSwitch={switchTo}
                  itemClassName="relative h-9 min-w-9 px-2 before:absolute before:inset-x-0 before:-inset-y-1"
                />
              )}
              <SheetTrigger
                className="flex h-11 items-center gap-1.5 border border-white/30 px-2.5 font-site-manrope text-xs font-bold tracking-[0.16em] uppercase transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={t("nav.openMenu")}
              >
                {t("nav.menuTitle")}
                <ChevronUpIcon className="size-4 text-site-neon" aria-hidden />
              </SheetTrigger>
            </div>
          </div>

          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[75dvh] gap-0 border-0 bg-transparent p-0 text-white"
          >
            <MountainSilhouette className="-mb-px shrink-0" />
            <div className="relative flex min-h-0 flex-1 flex-col bg-site-nav">
              <div className="flex h-14 shrink-0 items-center gap-3 pr-16 pl-6">
                <span aria-hidden className="h-0.5 w-8 bg-site-neon" />
                <SheetTitle className="font-site-manrope text-xs font-bold tracking-[0.2em] text-site-mist uppercase">
                  {t("nav.menuTitle")}
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">{t("nav.label")}</SheetDescription>
              <SheetClose className="absolute top-1.5 right-2 flex size-11 items-center justify-center border border-white text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <XIcon className="size-6" aria-hidden />
                <span className="sr-only">{t("nav.closeMenu")}</span>
              </SheetClose>

              <nav aria-label={t("nav.label")} className="min-h-0 flex-1 overflow-y-auto">
                <ul className="flex flex-col divide-y divide-white/15 border-t border-white/15">
                  {nav.map((item, index) => {
                    const active = isActiveLink(pathname, item);
                    return (
                      <li
                        key={`${item.href}-${index}`}
                        className="motion-safe:animate-in motion-safe:duration-300 motion-safe:fill-mode-backwards motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
                        style={{ animationDelay: `${120 + index * 40}ms` }}
                      >
                        <ChromeAnchor
                          link={item}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex min-h-[60px] items-center gap-4 px-6 py-3 font-site-display text-[28px] leading-none uppercase transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white min-[400px]:text-[32px]",
                            active ? "text-white" : "text-white/90"
                          )}
                        >
                          <span aria-hidden className="flex w-3.5 shrink-0 items-center">
                            {active ? (
                              <span className="block h-7 w-3.5 bg-site-neon" />
                            ) : (
                              <span className="block h-px w-3.5 bg-site-mist" />
                            )}
                          </span>
                          {item.label}
                        </ChromeAnchor>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/15 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {showLanguages ? (
                  <LanguageToggle
                    locale={locale}
                    label={t("language.label")}
                    languages={languages}
                    onSwitch={switchTo}
                    itemClassName="h-11 min-w-12 px-3"
                  />
                ) : (
                  <span />
                )}
                <Image
                  src="/images/site/materm-emblem.svg"
                  alt=""
                  width={78}
                  height={65}
                  className="h-9 w-auto shrink-0"
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ---- md+ : the Figma bar, identical to site-header.tsx ---- */}
        <ChromeAnchor
          link={HOME_LINK}
          className="hidden font-site-display text-lg leading-none md:block md:sr-only md:focus-visible:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70"
          aria-label={t("nav.home")}
        >
          {brand.name}
        </ChromeAnchor>

        <nav aria-label={t("nav.label")} className="hidden md:block">
          <ul className="flex items-center gap-3 font-site-manrope text-sm">
            {nav.map((item, index) => {
              const active = isActiveLink(pathname, item);
              return (
                <li key={`${item.href}-${index}`}>
                  <ChromeAnchor
                    link={item}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70",
                      active
                        ? "bg-site-green-500 px-5 font-bold"
                        : "rounded-full font-semibold hover:bg-white/10"
                    )}
                  >
                    {item.label}
                  </ChromeAnchor>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {showLanguages && (
            <ToggleGroup
              type="single"
              spacing={2}
              value={locale}
              aria-label={t("language.label")}
              onValueChange={(value) => {
                // Radix emits "" when the active item is clicked again — ignore.
                if (value && value !== locale && languages.some((l) => l.code === value)) switchTo(value);
              }}
            >
              {languages.map((option) => (
                <ToggleGroupItem
                  key={option.code}
                  value={option.code}
                  className={cn(
                    "h-auto min-w-0 rounded-full px-2.5 py-1.5 font-site-manrope text-xs text-site-mist hover:bg-white/10 hover:text-white",
                    "data-[state=on]:bg-site-nav-chip data-[state=on]:font-bold data-[state=on]:text-white"
                  )}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      </div>
    </header>
  );
}
