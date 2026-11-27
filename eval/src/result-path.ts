import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where a run's files go: `<dir>/<date>-<set>-<commit>` plus `.json` and `-summary.md`
 * (eval-suite §3.3). Research B.4 cites these files, so a later run gets `-2`, `-3`, … instead.
 */
export function freeResultBase(
  dir: string,
  name: { date: string; set: string; commit: string },
  exists: (path: string) => boolean,
): string {
  const first = join(dir, `${name.date}-${name.set}-${name.commit}`);
  const taken = (base: string) => exists(`${base}.json`) || exists(`${base}-summary.md`);
  let base = first;
  for (let n = 2; taken(base); n++) base = `${first}-${n}`;
  return base;
}

/** Throws `EEXIST` rather than replace a file, even one created after the name was chosen. */
export function writeNewFile(path: string, text: string): void {
  writeFileSync(path, text, { flag: "wx" });
}
