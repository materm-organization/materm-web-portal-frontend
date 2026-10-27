// Hosts `next/image` may fetch media from (doc/08 §3.12, PF-11). Pure: no imports, no "server-only",
// so `next.config.ts` (build time) and `media.ts` (render time) share ONE parser.
//
// Env (value = URL of the file service, i.e. `file.path_ip`; several may be comma-separated):
//   MEDIA_BASE_URL   e.g. http://files.example.com:8080   (unset / blank / invalid = no remote host)
// Bundled media are relative (`/images/site/...`, served from public/) and need no entry.

export interface MediaHost {
  protocol: "http" | "https";
  hostname: string;
  /** "" = default port of the protocol */
  port: string;
}

export function parseMediaHosts(raw: string | undefined | null): MediaHost[] {
  const out: MediaHost[] = [];
  for (const part of (raw ?? "").split(",")) {
    const value = part.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      out.push({ protocol: url.protocol === "http:" ? "http" : "https", hostname: url.hostname, port: url.port });
    } catch {
      /* an invalid entry is ignored (the build must not fail on a typo) */
    }
  }
  return out;
}

/** `images.remotePatterns` for next.config.ts */
export function toRemotePatterns(hosts: readonly MediaHost[]): { protocol: "http" | "https"; hostname: string; port: string; pathname: string }[] {
  return hosts.map((h) => ({ protocol: h.protocol, hostname: h.hostname, port: h.port, pathname: "/**" }));
}

/**
 * Can `next/image` render this URL? Relative (`/x`, not `//host`) always; absolute http(s) only when its
 * origin is one of `hosts`. Anything else (other host, `data:`, `javascript:`, protocol-relative) = false:
 * an unconfigured host makes `next/image` THROW, which would take the whole page down.
 */
export function isRenderableImageUrl(url: string, hosts: readonly MediaHost[] = parseMediaHosts(process.env.MEDIA_BASE_URL)): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith("/")) return !url.startsWith("//") && !url.includes("\\");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const protocol = parsed.protocol === "http:" ? "http" : "https";
  return hosts.some((h) => h.protocol === protocol && h.hostname === parsed.hostname && h.port === parsed.port);
}
