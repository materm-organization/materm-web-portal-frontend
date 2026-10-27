// Keeps "— a recap" on one line so the hero title breaks like the design
// ("MUSIC NIGHT UNDER THE STARS" / "— A RECAP") instead of wherever it fits:
// after the em dash every space becomes a no-break space. Pure (usable from Server Components).
export function glueAfterDash(title: string): string {
  return title.replace(/—\s+(.*)$/, (_, rest: string) => `— ${rest.replace(/ /g, " ")}`);
}
