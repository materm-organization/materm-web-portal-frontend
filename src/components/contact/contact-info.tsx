import { Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Reveal, revealDelay } from "@/components/site/motion";

// TODO(content): the values in `i18n/site/contact.*.json` -> `info.*.value` are
// PLACEHOLDERS (address, phone, email, hours). The owner must replace them with
// real data. The `tel:` / `mailto:` hrefs below are derived from the same i18n
// values, so they follow automatically; keep the phone value in a dialable format.
const LINK_CLASS =
  "break-words underline-offset-4 hover:text-site-green-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-700";

type InfoKey = "visit" | "call" | "email" | "hours";

const ROWS: { key: InfoKey; Icon: LucideIcon }[] = [
  { key: "visit", Icon: MapPin },
  { key: "call", Icon: Phone },
  { key: "email", Icon: Mail },
  { key: "hours", Icon: Clock },
];

export async function ContactInfo() {
  const t = await getTranslations("contact.info");

  const renderValue = (key: InfoKey) => {
    const value = t(`${key}.value`);
    if (key === "call") {
      return (
        <a href={`tel:${value.replace(/[^+\d]/g, "")}`} className={LINK_CLASS}>
          {value}
        </a>
      );
    }
    if (key === "email") {
      return (
        <a href={`mailto:${value}`} className={LINK_CLASS}>
          {value}
        </a>
      );
    }
    return value;
  };

  return (
    <ul className="flex flex-col gap-6 sm:gap-8">
      {ROWS.map(({ key, Icon }, index) => (
        <Reveal
          as="li"
          key={key}
          delay={revealDelay(index)}
          className="flex items-start gap-4 sm:gap-5"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center bg-site-green-900 text-white sm:size-12"
          >
            <Icon className="size-5 sm:size-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium tracking-[0.2em] text-site-green-600 uppercase">
              {t(`${key}.label`)}
            </p>
            <p className="mt-1 text-lg leading-[1.5] break-words text-site-ink sm:text-xl">
              {renderValue(key)}
            </p>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}
