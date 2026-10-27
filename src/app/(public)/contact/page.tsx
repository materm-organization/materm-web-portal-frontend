import { getTranslations } from "next-intl/server";

import { ContactFaq } from "@/components/contact/contact-faq";
import { ContactSection } from "@/components/contact/contact-section";
import { PageHero } from "@/components/site/page-hero";
import { createTranslatedSiteMetadata } from "@/lib/site-metadata";

export const generateMetadata = () =>
  createTranslatedSiteMetadata("contact", "meta.title", "meta.description");

export default async function ContactPage() {
  const t = await getTranslations("contact.hero");

  return (
    <>
      {/* The photo is decorative; PageHero provides the page's only <h1>. */}
      <PageHero
        variant="brand"
        titleSpacing="wide"
        image="/images/site/hero-forest-stream.jpg"
        imageAlt=""
        title={t("title")}
        description={t("description")}
        animateIn
        priority
      />
      <ContactSection />
      <ContactFaq />
    </>
  );
}
