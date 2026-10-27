import { getTranslations } from "next-intl/server";

import { CONTACT_TOPICS } from "@/components/contact/contact-validation";

import { paragraphsToDoc } from "../rich-text";
import type { ContactInfoItem, SectionData } from "../types";
import { staticImage } from "./media";

// The Contact page as sections (pre-CMS data source, see adapters/home.ts). The address, phone,
// email and hours in `contact.info.*.value` are PLACEHOLDERS (later: settings group `contact`).
const FAQ_ITEMS = ["getting", "times", "events", "groups"] as const;

export async function getContactSections(): Promise<SectionData[]> {
  const [hero, intro, info, form, faq] = await Promise.all([
    getTranslations("contact.hero"),
    getTranslations("contact.intro"),
    getTranslations("contact.info"),
    getTranslations("contact.form"),
    getTranslations("contact.faq"),
  ]);

  const call = info("call.value");
  const email = info("email.value");
  const infoItems: ContactInfoItem[] = [
    { icon: "map_pin", label: info("visit.label"), value: info("visit.value"), href: null },
    { icon: "phone", label: info("call.label"), value: call, href: `tel:${call.replace(/[^+\d]/g, "")}` },
    { icon: "mail", label: info("email.label"), value: email, href: `mailto:${email}` },
    { icon: "clock", label: info("hours.label"), value: info("hours.value"), href: null },
  ];

  return [
    {
      id: "contact-hero",
      key: "hero_brand",
      version: 1,
      variant: "wide",
      anchorId: null,
      props: {
        title: hero("title"),
        description: hero("description"),
        cta: null,
        background: staticImage("/images/site/hero-forest-stream.jpg"),
        animateIn: true,
      },
    },
    {
      id: "contact-intro",
      key: "contact_section",
      version: 1,
      variant: null,
      anchorId: null,
      props: {
        eyebrow: intro("eyebrow"),
        title: intro("title"),
        description: intro("description"),
        info: infoItems,
        form: {
          slug: "contact",
          title: form("title"),
          description: form("description"),
          submitLabel: form("submit"),
          sendingLabel: form("sending"),
          success: {
            title: form("success.title"),
            description: form("success.description"),
            againLabel: form("success.again"),
          },
          // Empty: every error text comes from the `forms.errors.*` bundle.
          messages: {},
          fields: [
            { key: "name", label: form("fields.name.label"), placeholder: form("fields.name.placeholder") },
            { key: "email", label: form("fields.email.label"), placeholder: form("fields.email.placeholder") },
            { key: "phone", label: form("fields.phone.label"), placeholder: form("fields.phone.placeholder") },
            {
              key: "topic",
              label: form("fields.topic.label"),
              placeholder: null,
              options: CONTACT_TOPICS.map((topic) => ({
                value: topic,
                label: form(`fields.topic.options.${topic}`),
              })),
            },
            { key: "message", label: form("fields.message.label"), placeholder: form("fields.message.placeholder") },
          ],
        },
      },
    },
    {
      id: "contact-faq",
      key: "faq",
      version: 1,
      variant: "soft",
      anchorId: null,
      props: {
        eyebrow: faq("eyebrow"),
        title: faq("title"),
        openFirst: true,
        items: FAQ_ITEMS.map((item) => ({
          id: item,
          question: faq(`items.${item}.question`),
          answer: paragraphsToDoc([faq(`items.${item}.answer`)]),
        })),
      },
    },
  ];
}
