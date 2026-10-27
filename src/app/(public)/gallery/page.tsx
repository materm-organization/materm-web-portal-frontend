import { getGallerySections } from "@/components/sections/adapters/gallery";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

export async function generateMetadata() {
  return createTranslatedSiteMetadata("gallery", "meta.title", "meta.description");
}

export default async function GalleryPage() {
  return <SectionRenderer sections={await getGallerySections()} />;
}
