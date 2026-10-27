import { useTranslations } from "next-intl";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  /** Highlighted category key. On the index, `undefined` + `showAll` highlights "All". */
  active?: string;
  /** Tabs in order (`key` goes into `/blog?category=<key>`), from the CMS categories (P-09 / `post_list`). */
  categories: readonly { key: string; label: string }[];
  /** Adds an "All" tab (index only; the article design has exactly five tabs). */
  showAll?: boolean;
  className?: string;
}

const ALL = "all";

// Category strip (Figma "Opening passage": 5 tabs, 25/30, active = bold green
// with a 3px underline). It is a navigation, not a widget with its own state:
// a plain <nav> of real `next/link`s to `/blog?category=<slug>` (crawlable, no
// client JS), the active one marked with `aria-current="page"`.
//
// Do NOT build this from Radix `Tabs` + `TabsTrigger asChild`: in a Server
// Component the trigger's child reaches Radix's Slot as a lazy RSC element on
// client-side navigation ("Primitive.button failed to slot onto its children")
// and the whole /blog page crashes, while a hard load works.
export function CategoryTabs({ active, categories, showAll = false, className }: CategoryTabsProps) {
  const t = useTranslations("blog");
  const value = active ?? (showAll ? ALL : "");

  const items: { value: string; href: string; label: string }[] = [
    ...(showAll ? [{ value: ALL, href: "/blog", label: t("categories.all") }] : []),
    ...categories.map(
      ({ key, label }) => ({
        value: key,
        href: `/blog?category=${key}`,
        label,
      }),
    ),
  ];

  return (
    <nav aria-label={t("categoryNavLabel")} className={cn("w-full", className)}>
      <ul className="mx-auto flex w-full max-w-[968px] items-stretch justify-start overflow-x-auto md:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.value} className="flex min-w-[110px] flex-none md:flex-1">
            <Link
              href={item.href}
              // Switching category only changes the list below: keep the scroll
              // position instead of jumping back to the top of the page.
              scroll={false}
              aria-current={item.value === value ? "page" : undefined}
              className="flex w-full items-center justify-center border-b-[3px] border-transparent px-3 py-1 text-lg leading-[30px] font-normal whitespace-nowrap text-site-ink transition-colors hover:text-site-green-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-site-green-700 md:text-xl lg:text-[25px] aria-[current=page]:border-site-green-700 aria-[current=page]:font-extrabold aria-[current=page]:text-site-green-700"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
