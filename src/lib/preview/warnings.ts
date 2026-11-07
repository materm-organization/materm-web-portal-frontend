// Backend warning codes of a preview (`data.preview.warnings[].code`, pkg/assemble/warnings.go) -> i18n key in the
// `preview.warnings` namespace. PURE. An unknown (new) code gets a generic line, never a raw code as prose.

export const WARNING_CODES = [
  "reference_not_published",
  "link_page_not_published",
  "post_not_published",
  "section_type_unknown",
  "shared_section_unavailable",
  "shared_section_not_live",
] as const;

export type WarningCode = (typeof WARNING_CODES)[number];

export function warningMessageKey(code: string): WarningCode | "unknown" {
  return (WARNING_CODES as readonly string[]).includes(code) ? (code as WarningCode) : "unknown";
}
