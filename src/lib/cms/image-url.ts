// Which image URLs the site renders (pure, no imports). The portal backend answers media URLs as either a
// site-relative path (`/images/site/...`, bundled, served from public/) or an absolute http(s) URL on the file
// service. There is no host allow-list: whatever absolute http(s) URL the API returns is rendered (the admin
// frontend does the same). Only the scheme is checked, so `javascript:`, `data:`, `file:` and
// protocol-relative / backslash junk never reach an <img>.

export function isRenderableImageUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith("/")) return !url.startsWith("//") && !url.includes("\\");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** Absolute http(s) URL = file-service media: served as is, never through the Next optimizer. */
export function isAbsoluteImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
