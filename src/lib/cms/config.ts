// Runtime configuration of the CMS data layer. Reads process.env at CALL time (server only).
// Variable names (values are never in the repo; secrets live in Netlify env / .env.local):
//   CMS_MODE                 mock | bundle (default) | api   ("fallback" = alias of bundle, doc/08 §8.7)
//   NEXT_PUBLIC_API_BASE_URL portal-backend base incl. /api/v1 (api mode). A relative/placeholder value = unconfigured -> bundle.
//                            NOTE: Next inlines NEXT_PUBLIC_* at BUILD time (server bundles too).
//   CMS_API_BASE_URL         optional server-only RUNTIME override of the above (no rebuild needed); wins when set
//   PORTAL_API_KEY           SECRET, sent as X-Portal-Key (server only, never NEXT_PUBLIC)
//   CMS_FETCH_TIMEOUT_MS     default 2000 (NFR-06)
//   CMS_MOCK_URL             mock mode base, default http://127.0.0.1:4010/api/v1 (scripts/cms/mock-api.mjs)
//   SITE_ENV / CONTEXT       robots.ts: "production" = allow

export type CmsMode = "mock" | "bundle" | "api";

export function getCmsMode(): CmsMode {
  const raw = (process.env.CMS_MODE ?? "").trim().toLowerCase();
  if (raw === "api" || raw === "mock") return raw;
  return "bundle"; // "bundle", "fallback", "", anything unknown
}

export interface ApiConfig {
  /** null = not usable (api mode without an absolute URL) */
  baseUrl: string | null;
  key: string | undefined;
  timeoutMs: number;
}

export function getApiConfig(mode: CmsMode): ApiConfig {
  const rawBase =
    mode === "mock"
      ? (process.env.CMS_MOCK_URL ?? "http://127.0.0.1:4010/api/v1")
      : (process.env.CMS_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "");
  const baseUrl = /^https?:\/\//i.test(rawBase.trim()) ? rawBase.trim().replace(/\/+$/, "") : null;
  const t = Number.parseInt(process.env.CMS_FETCH_TIMEOUT_MS ?? "", 10);
  return {
    baseUrl,
    key: process.env.PORTAL_API_KEY || undefined,
    timeoutMs: Number.isFinite(t) && t > 0 ? t : 2000,
  };
}
