// Applies CMS UI-string overrides (flat dotted keys, P-03) on top of next-intl messages (doc/08 §5.3).
type Tree = { [key: string]: string | Tree };

/** `site.nav.label` -> messages.site.nav.label; mutates and returns `messages`. Non-object path parts are replaced. */
export function applyUiStrings<T extends Tree>(messages: T, strings: Record<string, string>): T {
  for (const [dotted, value] of Object.entries(strings)) {
    const parts = dotted.split(".");
    let cur: Tree = messages;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = cur[parts[i]];
      if (typeof next !== "object" || next === null) cur[parts[i]] = {};
      cur = cur[parts[i]] as Tree;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return messages;
}
