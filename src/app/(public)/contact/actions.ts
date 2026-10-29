"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

import type { ContactActionState, ContactField } from "@/components/contact/contact-validation";
import { CONTACT_FIELDS } from "@/components/contact/contact-validation";
import { clientIpFromHeaders, clientUserAgent, submitContactForm } from "@/lib/forms/submit";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Contact form server action (used through `useActionState`). Never throws to the client: every outcome is a
 * `ContactActionState`.
 *
 * Delivery: `POST /api/v1/public/forms/{slug}/submissions` of the portal backend (P-15), server to server, with the
 * visitor's address, the honeypot and the signed fill time. The rules (modes, error mapping, spam contract) live in
 * `src/lib/forms/submit.ts` (this file may only export async functions).
 */
export async function submitContact(_prevState: ContactActionState, formData: FormData): Promise<ContactActionState> {
  try {
    const h = await headers();
    const get = (name: string) => h.get(name);
    let locale = "la";
    try {
      locale = await getLocale();
    } catch {
      // keep the default locale
    }
    return await submitContactForm({
      fields: Object.fromEntries(CONTACT_FIELDS.map((name: ContactField) => [name, field(formData, name)])),
      honeypot: field(formData, "company"),
      stamp: field(formData, "rt"),
      slug: field(formData, "form"),
      locale,
      ip: clientIpFromHeaders(get),
      userAgent: clientUserAgent(get),
    });
  } catch {
    // Unexpected failure. No payload in the log.
    console.error("[contact] delivery failed (unexpected error)");
    return { status: "error", code: "unavailable" };
  }
}
