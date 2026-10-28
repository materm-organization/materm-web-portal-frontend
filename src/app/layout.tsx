import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Manrope,
  Noto_Sans_Lao,
  Noto_Sans_Lao_Looped,
  Young_Serif,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { toBcp47 } from "@/lib/constants/locales";
import { QueryProvider } from "@/components/provider/query-provider";
import { ThemeProvider } from "@/components/provider/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Non-Latin-script locales need their own font, loaded conditionally
// — Latin-script locales fall back to Geist above.
// This project uses `la` (Lao) as its non-Latin locale; to support another
// one, load its font the same way here and extend the
// `locale === "la" ? ... : ...` branch below into a small lookup.
//
// `subsets` only controls which font files next/font preloads at build
// time — only "latin" is listed. Lao glyphs still load on demand via unicode-range, but
// since `la` is now the default locale, the Lao glyphs aren't preloaded,
// so the very first paint may briefly show a fallback font before the Lao
// webfont file arrives. Add "lao" to this array to preload it if that
// matters for this product.
const notoSansLao = Noto_Sans_Lao_Looped({
  variable: "--font-noto-sans-lao",
  subsets: ["latin"],
});

// Public marketing site (`src/app/(public)`) fonts — exposed as CSS variables
// and consumed through the `font-site*` Tailwind tokens declared under
// `.site` in globals.css.
//  - Noto Sans Lao: the site's body/heading face (design variable font).
//  - Manrope: nav bar, footer copy, blog article standfirst + body.
//  - Young Serif: display face for "MATERM" and the about-block titles.
const siteLao = Noto_Sans_Lao({
  variable: "--font-site-lao",
  subsets: ["lao", "latin"],
  display: "swap",
});

const siteManrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const siteYoungSerif = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Materm",
  description: "Materm - treehouse and camping at Phou Khao Khouay, Laos.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const fontClassName = locale === "la" ? notoSansLao.className : geistSans.className;

  return (
    <html
      lang={toBcp47(locale)}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansLao.variable} ${siteLao.variable} ${siteManrope.variable} ${siteYoungSerif.variable}`}
    >
      <body className={`${fontClassName} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
