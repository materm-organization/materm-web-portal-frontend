import { handleExit } from "@/lib/preview/handlers";
import { toResponse } from "@/lib/preview/respond";
import { cookieIsSecure } from "@/lib/preview/session";

// Leaves preview (PF-10): clears the cookie and Draft Mode, redirects to `?path=` (a CMS page path) or `/`.
// `?reason=expired` (used by the page when the backend says the token is dead) lands on the expired page instead.
// GET and POST. Link to it with a plain <a>, never next/link: a prefetch would end the session.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exit = (req: Request) => toResponse(handleExit({ url: req.url, method: req.method, secure: cookieIsSecure(process.env) }));

export const GET = exit;
export const POST = exit;
