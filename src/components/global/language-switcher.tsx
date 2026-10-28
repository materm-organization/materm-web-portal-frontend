"use client";

import Cookies from "js-cookie";
import { LanguagesIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { ChromeLanguage } from "@/lib/cms/site-chrome";
import { LOCALE_COOKIE_NAME } from "@/lib/constants/locales";
import { cn } from "@/lib/utils";

/**
 * Switching language sets the `locale` cookie the data layer reads (`getRequestLocale`) and refreshes the
 * current route SOFTLY (`router.refresh()`: the server re-renders with the new cookie, no page reload, client
 * state such as the open menu survives). Pages are dynamic because they read that cookie.
 * The set of languages is the one the API returned (see `SiteChrome.languages`), not a list in code.
 */
export function useSwitchLocale() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const switchTo = useCallback(
    (code: string) => {
      Cookies.set(LOCALE_COOKIE_NAME, code, { path: "/", sameSite: "lax", expires: 365 });
      startTransition(() => router.refresh());
    },
    [router],
  );
  return { switchTo, pending };
}

// Standalone dropdown entry point for switching language (the public site uses the toggle in `SiteHeader`).
export function LanguageSwitcher({ languages }: { languages: ChromeLanguage[] }) {
  const locale = useLocale();
  const { switchTo } = useSwitchLocale();
  if (languages.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Change language">
          <LanguagesIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            className={cn(l.code === locale && "font-medium")}
            onSelect={() => {
              if (l.code !== locale) switchTo(l.code);
            }}
          >
            {l.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
