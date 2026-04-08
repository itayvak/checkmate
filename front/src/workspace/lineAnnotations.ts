import type { LineAnnotation, ProjectComment } from "../api";

export type ResolvedLineComment = {
  title: string;
  details: string;
  showDetails: boolean;
  /** `comment_id` points to a library entry that no longer exists. */
  isStaleLibraryRef?: boolean;
};

function resolveLibraryAnnotation(
  cid: string,
  byId: Map<string, ProjectComment>,
  seenCommentIds: Set<string>,
): ResolvedLineComment {
  const lib = byId.get(cid);
  if (!lib) {
    return {
      title: "(deleted comment)",
      details: "",
      showDetails: false,
      isStaleLibraryRef: true,
    };
  }
  const t = (lib.title || "").trim() || "(deleted comment)";
  const det = (lib.details || "").trim();
  const first = !seenCommentIds.has(cid);
  seenCommentIds.add(cid);
  return {
    title: t,
    details: det,
    showDetails: first && det.length > 0,
    isStaleLibraryRef: false,
  };
}

export function buildLineAnnotationMap(
  annotations: LineAnnotation[] | undefined,
  commentLibrary: ProjectComment[],
): Map<number, ResolvedLineComment> {
  const byId = new Map(commentLibrary.map((c) => [c.id, c]));
  const sorted = [...(annotations ?? [])]
    .filter((a) => a.line != null)
    .sort((a, b) => Number(a.line) - Number(b.line));
  const seenIds = new Set<string>();
  const map = new Map<number, ResolvedLineComment>();
  for (const a of sorted) {
    if (a.line == null) continue;
    const ln = Math.floor(Number(a.line));
    if (!Number.isFinite(ln) || ln < 1) continue;

    const direct =
      a.comment != null && String(a.comment).trim() !== "" ? String(a.comment).trim() : "";
    if (direct) {
      map.set(ln, { title: direct, details: "", showDetails: true, isStaleLibraryRef: false });
      continue;
    }
    const cid = a.comment_id != null ? String(a.comment_id).trim() : "";
    if (!cid) continue;
    map.set(ln, resolveLibraryAnnotation(cid, byId, seenIds));
  }
  return map;
}

/** Sorted line numbers for review walk — same inclusion rules as the annotation rail overlay. */
export function getReviewQueueLineNumbers(
  annotations: LineAnnotation[] | undefined,
  commentLibrary: ProjectComment[],
  lineCount: number,
): number[] {
  const map = buildLineAnnotationMap(annotations, commentLibrary);
  const maxLine = Math.max(0, Math.floor(lineCount));
  return [...map.entries()]
    .filter(
      ([lineNum, rc]) =>
        lineNum >= 1 &&
        lineNum <= maxLine &&
        String(rc.title).trim() !== "",
    )
    .map(([lineNum]) => lineNum)
    .sort((a, b) => a - b);
}
