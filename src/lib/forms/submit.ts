import "server-only";
// Delivery of the contact form to the portal backend (P-15, doc/08 §6): `POST /api/v1/public/forms/{slug}/submissions`,
// server to server, `X-Portal-Key` from PORTAL_API_KEY (added by `cmsFetch`). The server action `contact/actions.ts`
// only collects the request facts (form data, headers, locale) and calls `submitContactForm`.
//
//  - spam contract (backend `modules/forms`): the honeypot value is FORWARDED (the backend scores it 100 and still answers
//    200 so a bot learns nothing); `elapsed_ms` comes from the signed render stamp (`render-stamp.ts`), 0 when the stamp
//    is missing or forged (the backend scores that 90 = spam); `X-Client-IP` / `X-Client-User-Agent` carry the visitor,
//    otherwise the whole site would share the rate-limit bucket of this server's address.
//  - modes: PRODUCTION always calls the real API, whatever CMS_MODE says (CMS_MODE only decides where content is read
//    from; a message must never vanish into the bundle). Outside production a message is only SENT with CMS_MODE=api and
//    an API base URL; otherwise (bundle, mock, no URL) the dev simulation answers success after 600 ms and nothing leaves
//    the process. Production without an API base URL or without FORM_RENDER_SECRET answers "unconfigured".
//  - timeout 10 s, a POST is never retried; the log carries a status only, never the body, the e-mail or the IP.
import { cmsFetch } from "@/lib/cms/client";
import { getApiConfig, getCmsMode } from "@/lib/cms/config";
import type { ApiFieldError, CmsResult } from "@/lib/cms/result";
import {
  CONTACT_FIELDS,
  sanitizeContactValues,
  validateContact,
  type ContactActionState,
  type ContactField,
  type ContactFieldError,
  type ContactValues,
} from "@/components/contact/contact-validation";
import { renderSecret, verifyRenderStamp } from "./render-stamp";

export const DELIVERY_TIMEOUT_MS = 10_000;
export const SIMULATED_DELAY_MS = 600;
/** where the form lives; the backend stores it with the submission */
export const CONTACT_SOURCE_PATH = "/contact";
const SLUG_RE = /^[a-z0-9_-]{1,64}$/;
const FIELD_ERRORS: readonly string[] = ["required", "email", "messageShort", "phone"] satisfies ContactFieldError[];

export interface SubmitInput {
  /** raw field values as posted */
  fields: Partial<Record<ContactField, unknown>>;
  /** value of the hidden honeypot field */
  honeypot: string;
  /** hidden `rt` field */
  stamp: string;
  /** hidden form slug (signed into the stamp) */
  slug: string;
  /** locale code of the visitor (`la` / `en`) */
  locale: string;
  /** visitor address / user agent as seen by this server (null = unknown) */
  ip: string | null;
  userAgent: string | null;
}

export interface SubmitDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

// ---------------------------------------------------------------- visitor facts from the request headers

const IP_HEADERS = ["x-nf-client-connection-ip", "x-real-ip"] as const;

/** The visitor's address: the platform's own header first (Netlify), then x-real-ip, then the first x-forwarded-for entry. */
export function clientIpFromHeaders(get: (name: string) => string | null | undefined): string | null {
  for (const name of IP_HEADERS) {
    const v = get(name)?.trim();
    if (v) return v.slice(0, 64);
  }
  const first = get("x-forwarded-for")?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : null;
}

export const clientUserAgent = (get: (name: string) => string | null | undefined): string | null => get("user-agent")?.trim().slice(0, 300) || null;

// ---------------------------------------------------------------- result mapping (pure)

/** Maps the backend's answer to what the form shows (doc/08 §6.4). */
export function mapSubmitResult(res: CmsResult<unknown>): ContactActionState {
  if (res.kind === "ok") return { status: "success" };
  if (res.kind === "redirect") return { status: "error", code: "unavailable" };
  const status = res.status;
  if (status === 422) {
    const errors = fieldErrors(res.errors ?? []);
    return Object.keys(errors).length > 0 ? { status: "error", errors } : { status: "error", code: "generic" };
  }
  if (status === 429) return { status: "error", code: "rateLimited" };
  if (status === 404 || status === "unconfigured") return { status: "error", code: "unconfigured" };
  if (status === 400 || status === 413 || status === 415) return { status: "error", code: "generic" };
  // 5xx, 401 (our portal key is wrong), 403, 408, timeout, network, an unusable body: not the visitor's fault
  if (typeof status === "number" && status >= 400 && status < 500 && ![401, 403, 408].includes(status)) return { status: "error", code: "generic" };
  return { status: "error", code: "unavailable" };
}

/** `/data/<field>` + a code the form can show -> ContactErrors. Anything else is ignored. */
function fieldErrors(list: readonly ApiFieldError[]): Partial<Record<ContactField, ContactFieldError>> {
  const out: Partial<Record<ContactField, ContactFieldError>> = {};
  for (const e of list) {
    const field = /^\/data\/([a-z]+)$/.exec(e.path)?.[1] as ContactField | undefined;
    if (field && (CONTACT_FIELDS as readonly string[]).includes(field) && FIELD_ERRORS.includes(e.code) && !out[field]) {
      out[field] = e.code as ContactFieldError;
    }
  }
  return out;
}

// ---------------------------------------------------------------- delivery

type Plan = "simulate" | "send" | "unconfigured";

export function planDelivery(env: { NODE_ENV?: string } = process.env): Plan {
  const production = env.NODE_ENV === "production";
  const hasApi = getApiConfig("api").baseUrl !== null;
  if (!production) return getCmsMode() === "api" && hasApi ? "send" : "simulate";
  return hasApi ? "send" : "unconfigured";
}

const warned = new Set<string>();
function logOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(message);
}

export async function submitContactForm(input: SubmitInput, deps: SubmitDeps = {}): Promise<ContactActionState> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const values: ContactValues = sanitizeContactValues(input.fields);
  const errors = validateContact(values);
  if (Object.keys(errors).length > 0) return { status: "error", errors, values };

  const plan = planDelivery();
  if (plan === "simulate") {
    // ---------------------------------------------------------------------------------------------
    // DEV/DEMO ONLY: nothing is sent anywhere. Set CMS_MODE=api (and NEXT_PUBLIC_API_BASE_URL /
    // CMS_API_BASE_URL + PORTAL_API_KEY) to deliver messages to the portal backend (P-15).
    // ---------------------------------------------------------------------------------------------
    logOnce("simulate", "[contact] simulated: CMS_MODE is not 'api' (or no API base URL); nothing was sent");
    await sleep(SIMULATED_DELAY_MS);
    return { status: "success" };
  }
  if (plan === "unconfigured") {
    logOnce("no-api", "[contact] the portal API base URL is not configured (NEXT_PUBLIC_API_BASE_URL / CMS_API_BASE_URL); message not delivered");
    return { status: "error", code: "unconfigured", values };
  }

  const secret = renderSecret();
  if (!secret) {
    // without a secret no visitor can prove a fill time, and every real message would be stored as spam
    logOnce("no-secret", "[contact] FORM_RENDER_SECRET is not set (>= 32 characters required in production); message not delivered");
    return { status: "error", code: "unconfigured", values };
  }
  const slug = SLUG_RE.test(input.slug) ? input.slug : "contact";
  const stamp = verifyRenderStamp(input.stamp, slug, now(), secret);

  const headers: Record<string, string> = {};
  if (input.ip) headers["X-Client-IP"] = input.ip;
  if (input.userAgent) headers["X-Client-User-Agent"] = input.userAgent;

  const res = await cmsFetch<unknown>(`/public/forms/${slug}/submissions`, {
    method: "POST",
    tags: [],
    revalidate: 0,
    noStore: true,
    forceApi: true,
    timeoutMs: DELIVERY_TIMEOUT_MS,
    headers,
    body: {
      locale: input.locale,
      source_path: CONTACT_SOURCE_PATH,
      data: { name: values.name, email: values.email, phone: values.phone, topic: values.topic, message: values.message },
      honeypot: input.honeypot.slice(0, 200),
      // a missing or forged stamp is 0: the backend treats it as "too fast" (spam)
      elapsed_ms: stamp ? stamp.elapsedMs : 0,
      ...(stamp ? { rendered_at: new Date(stamp.renderedAt).toISOString() } : {}),
    },
  });

  const state = mapSubmitResult(res);
  if (state.status === "success") return state;
  if (res.kind === "error" && res.status === 401) {
    logOnce("key", "[contact] the portal API rejected PORTAL_API_KEY; message not delivered");
  } else if (res.kind !== "error" || res.status !== 422) {
    // status only: never the message, the e-mail or the address
    console.error(`[contact] delivery failed (${res.kind === "error" ? res.status : res.kind})`);
  }
  return { ...state, values };
}
