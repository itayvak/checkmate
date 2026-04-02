/**
 * Match legacy `compareByNumericLabel` (templates-old) so names like
 * `foo1.py`, `foo2.py`, `foo10.py` order numerically.
 */
export function compareSourceFilenames(a: string, b: string): number {
  const aLabel = String(a || "");
  const bLabel = String(b || "");
  const aNumMatch = aLabel.match(/\d+/);
  const bNumMatch = bLabel.match(/\d+/);
  const aHasNum = Boolean(aNumMatch);
  const bHasNum = Boolean(bNumMatch);

  if (aHasNum && bHasNum && aNumMatch && bNumMatch) {
    const diff = Number(aNumMatch[0]) - Number(bNumMatch[0]);
    if (diff !== 0) return diff;
  } else if (aHasNum && !bHasNum) {
    return -1;
  } else if (!aHasNum && bHasNum) {
    return 1;
  }

  return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: "base" });
}

export function sortSourcesByFilename<T extends { filename: string }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => compareSourceFilenames(x.filename, y.filename));
}
