import { NextResponse, type NextRequest } from "next/server";

import { PREVIEW_COOKIE, cookieIsSecure, planRefresh } from "@/lib/preview/session";

// Sliding preview session (PF-10). Cookies cannot be written while a Server Component renders, so the 30-minute
// window is refreshed here. The matcher only fires for requests that CARRY the preview cookie, so visitors never
// run this and public pages are untouched. Pages only (no `_next`, no `api`, no files); a prefetch does not count
// as activity. Adds `X-Robots-Tag: noindex` to the editor's page responses.
export function proxy(request: NextRequest) {
  const plan = planRefresh({
    cookieValue: request.cookies.get(PREVIEW_COOKIE)?.value,
    pathname: request.nextUrl.pathname,
    isPrefetch: request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch",
    secure: cookieIsSecure(process.env),
  });
  if (!plan) return NextResponse.next();
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(plan.headers)) response.headers.set(name, value);
  for (const cookie of plan.setCookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

// The matcher must be a literal (statically analysed at build time): keep the cookie name in sync with PREVIEW_COOKIE.
export const config = {
  matcher: [{ source: "/((?!_next/|api/).*)", has: [{ type: "cookie", key: "materm_preview" }] }],
};
