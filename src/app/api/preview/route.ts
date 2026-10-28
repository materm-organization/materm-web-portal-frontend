import { getCmsMode } from "@/lib/cms/config";
import { resolvePreview } from "@/lib/cms/preview";
import { handleStart } from "@/lib/preview/handlers";
import { toResponse } from "@/lib/preview/respond";
import { cookieIsSecure } from "@/lib/preview/session";

// Entry point of a preview link (PF-10, doc/08 §3.9): `/api/preview?token=<raw>&path=/our-path&locale=en`, opened by
// the editor from the admin. Verifies the token with the backend (`GET /preview/resolve`), keeps it in an HttpOnly
// cookie and redirects (307) to the page WITHOUT the token in the URL. All logic: `src/lib/preview/handlers.ts`.
// Nothing here logs the URL, the query or the token. Node runtime, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return toResponse(
    await handleStart({
      url: req.url,
      cookieHeader: req.headers.get("cookie"),
      mode: getCmsMode(),
      secure: cookieIsSecure(process.env),
      resolve: resolvePreview,
    }),
  );
}
