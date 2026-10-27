// DOM ids of sections (doc/08 section 4.4, Q-04-7: the same section type may repeat on a page,
// so no id is hard-coded in a component). Pure helpers, safe to call from Server Components.

/** `anchor_id ?? "s-" + public_id` (the public_id is used whole: the head of a UUIDv7 is a timestamp). */
export function sectionDomId(section: { id: string; anchorId: string | null }): string {
  return section.anchorId ? section.anchorId : `s-${section.id}`;
}

/** Id of a part of a section, e.g. `subId(domId, "title")` -> `s-0192...-title`. */
export function subId(domId: string, suffix: string): string {
  return `${domId}-${suffix}`;
}

/**
 * Ids for a whole page, in order. An `anchor_id` that repeats gets `-2`, `-3`... (there is no
 * DB constraint yet); `onDuplicate` is called once per repeat so the caller can log it.
 */
export function pageDomIds(
  sections: readonly { id: string; anchorId: string | null }[],
  onDuplicate?: (anchorId: string, resolved: string) => void,
): string[] {
  const used = new Set<string>();
  return sections.map((section) => {
    const base = sectionDomId(section);
    let candidate = base;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${base}-${n}`;
    if (candidate !== base) onDuplicate?.(base, candidate);
    used.add(candidate);
    return candidate;
  });
}
