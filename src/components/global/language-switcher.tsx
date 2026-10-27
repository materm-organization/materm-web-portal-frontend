"use client";

import Cookies from "js-cookie";
import { LanguagesIcon } from "lucide-react";
import { useLocale } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE_NAME, LOCALES, type LocaleCode } from "@/lib/constants/locales";
import { cn } from "@/lib/utils";

// Switching language is a full page reload, not a client-side re-render —
// messages are resolved server-side per-request in i18n/request.ts.
// Exported so the public site header (components/site) reuses the exact
// same cookie mechanism.
export function switchLocale(code: LocaleCode) {
  Cookies.set(LOCALE_COOKIE_NAME, code, { path: "/" });
  window.location.reload();
}

// Standalone dropdown entry point for switching language.
export function LanguageSwitcher() {
  const locale = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Change language">
          <LanguagesIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            className={cn(l.code === locale && "font-medium")}
            onSelect={() => switchLocale(l.code)}
          >
            <span className="mr-2">{l.flag}</span>
            {l.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
