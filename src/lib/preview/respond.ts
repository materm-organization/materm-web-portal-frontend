import "server-only";
import { draftMode } from "next/headers";

import { NO_STORE_HEADERS, type HandlerResult } from "./handlers";

/** HandlerResult -> Response (relative Location, no-store, cookies) + Next Draft Mode switch. */
export async function toResponse(result: HandlerResult): Promise<Response> {
  const headers = new Headers({ ...NO_STORE_HEADERS, Location: result.location });
  for (const cookie of result.setCookies) headers.append("Set-Cookie", cookie);
  const draft = await draftMode();
  if (result.draft === "enable") draft.enable();
  else draft.disable();
  return new Response(null, { status: result.status, headers });
}
