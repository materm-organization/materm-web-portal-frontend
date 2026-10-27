"use server";

import { getLocale } from "next-intl/server";

import {
  sanitizeContactValues,
  validateContact,
  type ContactActionState,
} from "@/components/contact/contact-validation";

const DELIVERY_TIMEOUT_MS = 10_000;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Contact form server action (used through `useActionState`). Never throws to
 * the client: every outcome is a `ContactActionState`.
 *
 * Delivery: `CONTACT_ENDPOINT` (server-only env var) receives a JSON POST
 * { name, email, phone, topic, message, locale, submittedAt }.
 */
export async function submitContact(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  // Honeypot: bots fill the hidden `company` input. Pretend it worked.
  if (field(formData, "company").trim() !== "") {
    return { status: "success" };
  }

  const values = sanitizeContactValues({
    name: field(formData, "name"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    topic: field(formData, "topic"),
    message: field(formData, "message"),
  });

  try {
    const errors = validateContact(values);
    if (Object.keys(errors).length > 0) {
      return { status: "error", errors, values };
    }

    const endpoint = process.env.CONTACT_ENDPOINT?.trim();

    if (!endpoint) {
      if (process.env.NODE_ENV !== "production") {
        // ---------------------------------------------------------------
        // TODO: connect a real mail/CRM endpoint before launch.
        // DEV/DEMO MOCK ONLY: nothing is sent anywhere. Set CONTACT_ENDPOINT
        // (server env) to deliver messages. In production the missing
        // endpoint is reported as an error instead of faking success.
        // ---------------------------------------------------------------
        await new Promise((resolve) => setTimeout(resolve, 600));
        return { status: "success" };
      }
      console.error("[contact] CONTACT_ENDPOINT is not configured; message not delivered");
      return { status: "error", code: "unconfigured", values };
    }

    let locale = "la";
    try {
      locale = await getLocale();
    } catch {
      // keep the default locale
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        locale,
        submittedAt: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Status only: never log the message body or the visitor's email.
      console.error(`[contact] delivery failed with HTTP ${response.status}`);
      return { status: "error", code: "generic", values };
    }

    return { status: "success" };
  } catch {
    // Timeout / network failure. No payload in the log.
    console.error("[contact] delivery failed (network error or timeout)");
    return { status: "error", code: "generic", values };
  }
}
