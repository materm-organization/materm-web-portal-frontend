import { Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";

import type { ContactIcon, ContactInfoItem } from "@/components/sections/types";
import { Reveal, revealDelay } from "@/components/site/motion";

// TODO(content): the values in `i18n/site/contact.*.json` -> `info.*.value` are
// PLACEHOLDERS (address, phone, email, hours). The owner must replace them with
// real data (later: settings group `contact`). The `tel:` / `mailto:` hrefs are
// resolved by whoever builds the section props (see `sections/adapters/contact.ts`).
const LINK_CLASS =
  "break-words underline-offset-4 hover:text-site-green-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-green-700";

// Icon registry (04 section 3.1: icons are code, the type only names them).
const ICONS: Record<ContactIcon, LucideIcon> = {
  map_pin: MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
};

export function ContactInfo({ items }: { items: readonly ContactInfoItem[] }) {
  return (
    <ul className="flex flex-col gap-6 sm:gap-8">
      {items.map(({ icon, label, value, href }, index) => {
        const Icon = ICONS[icon];
        return (
          <Reveal
            as="li"
            key={`${icon}-${index}`}
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
                {label}
              </p>
              <p className="mt-1 text-lg leading-[1.5] break-words text-site-ink sm:text-xl">
                {href ? (
                  <a href={href} className={LINK_CLASS}>
                    {value}
                  </a>
                ) : (
                  value
                )}
              </p>
            </div>
          </Reveal>
        );
      })}
    </ul>
  );
}
