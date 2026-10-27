import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getHomeSections } from "@/components/sections/adapters/home";
import { SectionRenderer } from "@/components/sections/section-renderer";

// Home shows just the site name (absolute title bypasses the "%s | Materm" template).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home.meta");
  return { title: { absolute: t("title") }, description: t("description") };
}

export default async function HomePage() {
  return <SectionRenderer sections={await getHomeSections()} />;
}
