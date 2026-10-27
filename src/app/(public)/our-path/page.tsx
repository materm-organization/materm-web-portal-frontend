import { getOurPathSections } from "@/components/sections/adapters/our-path";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

export const generateMetadata = () =>
  createTranslatedSiteMetadata("ourPath", "meta.title", "meta.description");

export default async function OurPathPage() {
  return <SectionRenderer sections={await getOurPathSections()} />;
}
