// Shared, pure validation + sanitising for the contact form.
//
// NO "use client" / "use server" here: it is imported by both the client form
// (instant feedback) and the server action (the real check), so the two always
// apply the same rules.
//
// Contact form delivery (see `src/app/(public)/contact/actions.ts`):
//   CONTACT_ENDPOINT  server-only env var (never NEXT_PUBLIC_*). When set, each
//                     valid submission is POSTed to it as JSON
//                     { name, email, phone, topic, message, locale, submittedAt }
//                     with a 10 s timeout; a non-2xx answer shows the generic
//                     error. When unset: dev/test simulates success after
//                     ~600 ms, production shows the "unconfigured" error so the
//                     site never pretends to send a message.

export const CONTACT_TOPICS = ["booking", "events", "camping", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_FIELDS = ["name", "email", "phone", "topic", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Codes of `forms.errors.*` (the form's own `messages` win over the bundle). */
export type ContactFieldError = "required" | "email" | "messageShort" | "phone";
export type ContactErrors = Partial<Record<ContactField, ContactFieldError>>;

export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
}

export interface ContactActionState {
  status: "idle" | "success" | "error";
  errors?: ContactErrors;
  code?: "unconfigured" | "generic";
  values?: ContactValues;
}

export const CONTACT_INITIAL_STATE: ContactActionState = { status: "idle" };

export const CONTACT_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  emailMax: 254,
  phoneMax: 30,
  messageMin: 10,
  messageMax: 2000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9 +()\-.]+$/;

/** Strip control characters; single-line fields also lose newlines/tabs. Then trim and cap. */
export function sanitizeText(
  value: unknown,
  max: number,
  { multiline = false }: { multiline?: boolean } = {},
): string {
  if (typeof value !== "string") return "";
  let text = value.normalize("NFC").replace(/\r\n?/g, "\n");
  text = multiline
    ? text.replace(/(?![\n\t])\p{Cc}/gu, "")
    : text.replace(/\p{Cc}/gu, " ").replace(/ {2,}/g, " ");
  return text.trim().slice(0, max);
}

/** Sanitise raw (string-ish) values into the shape the rules run against. */
export function sanitizeContactValues(raw: Partial<Record<ContactField, unknown>>): ContactValues {
  return {
    name: sanitizeText(raw.name, CONTACT_LIMITS.nameMax),
    email: sanitizeText(raw.email, CONTACT_LIMITS.emailMax),
    phone: sanitizeText(raw.phone, CONTACT_LIMITS.phoneMax),
    topic: sanitizeText(raw.topic, 20),
    message: sanitizeText(raw.message, CONTACT_LIMITS.messageMax, { multiline: true }),
  };
}

export function validateContactField(
  field: ContactField,
  values: ContactValues,
): ContactFieldError | undefined {
  switch (field) {
    case "name":
      return values.name.length >= CONTACT_LIMITS.nameMin ? undefined : "required";
    case "email":
      if (!values.email) return "required";
      return EMAIL_RE.test(values.email) ? undefined : "email";
    case "phone":
      if (!values.phone) return undefined; // optional
      return PHONE_RE.test(values.phone) && values.phone.length <= CONTACT_LIMITS.phoneMax
        ? undefined
        : "phone";
    case "topic":
      return (CONTACT_TOPICS as readonly string[]).includes(values.topic) ? undefined : "required";
    case "message":
      if (!values.message) return "required";
      return values.message.length >= CONTACT_LIMITS.messageMin ? undefined : "messageShort";
  }
}

export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of CONTACT_FIELDS) {
    const error = validateContactField(field, values);
    if (error) errors[field] = error;
  }
  return errors;
}

/** First field (in visual order) that has an error. */
export function firstInvalidField(errors: ContactErrors): ContactField | undefined {
  return CONTACT_FIELDS.find((field) => errors[field]);
}
