import { getContactSections } from "@/components/sections/adapters/contact";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

export const generateMetadata = () =>
  createTranslatedSiteMetadata("contact", "meta.title", "meta.description");

export default async function ContactPage() {
  return <SectionRenderer sections={await getContactSections()} />;
}
