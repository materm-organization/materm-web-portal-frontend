import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Titles render through the template in `src/app/(public)/layout.tsx`
// (`%s | Materm`), so pass only the page title here.
//
// Static page:
//   export const generateMetadata = () => createSiteMetadata({ title: "Gallery" });
//
// Translated page (namespace/key from your i18n/site/<page>.{en,la}.json):
//   export async function generateMetadata() {
//     return createTranslatedSiteMetadata("gallery", "meta.title", "meta.description");
//   }
//
// Dynamic route (e.g. blog/[slug]): build the title from the fetched post.
export function createSiteMetadata({
  title,
  description,
}: {
  title: string;
  description?: string;
}): Metadata {
  return { title, description };
}

export async function createTranslatedSiteMetadata(
  namespace: string,
  titleKey: string,
  descriptionKey?: string
): Promise<Metadata> {
  const t = await getTranslations(namespace);
  return createSiteMetadata({
    title: t(titleKey),
    description: descriptionKey ? t(descriptionKey) : undefined,
  });
}
