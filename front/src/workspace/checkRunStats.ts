import type { LineAnnotation, ProjectComment, WorkspaceStudent } from "../api";

/** Matches per-source check chip semantics (structured cases or legacy exit code). */
export function checkRunPassedTotal(check: NonNullable<WorkspaceStudent["check"]>): {
  passed: number;
  total: number;
} {
  let passed = 0;
  let total = 1;
  if (check.check_cases && check.check_cases.length > 0) {
    total = check.total ?? check.check_cases.length;
    passed = check.passed ?? check.check_cases.filter((t) => t.passed).length;
  } else if (check.exit_code === 0) {
    passed = 1;
  }
  return { passed, total };
}

/**
 * Compute the numeric grade (0–100) from a student's annotations and the comment library.
 * Grade = 100 − capped sum of deductions per comment_id (each library entry has max_points total cap per student).
 * Pass threshold: grade ≥ 70.
 */
export function computeAnnotationGrade(
  annotations: LineAnnotation[] | undefined,
  commentMap: Map<string, ProjectComment>,
): { score: number; passed: boolean } {
  if (!annotations || annotations.length === 0) {
    return { score: 100, passed: true };
  }
  const used = new Map<string, number>();
  let deduction = 0;
  for (const ann of annotations) {
    const cid = ann.comment_id;
    if (!cid) continue;
    const comment = commentMap.get(cid);
    if (!comment) continue;
    const pts = Math.max(0, comment.points ?? 0);
    const cap = Math.max(0, comment.max_points ?? 100);
    const u = used.get(cid) ?? 0;
    const room = Math.max(0, cap - u);
    const d = Math.min(pts, room);
    used.set(cid, u + d);
    deduction += d;
  }
  const score = Math.max(0, 100 - deduction);
  return { score, passed: score >= 70 };
}

/** Mirrors `compose_student_summary` in back/app/llm/review_postprocess.py. */
export function composeStudentSummary(improvement: string, score: number, passed: boolean): string {
  const gradeLine = passed
    ? "חניך יקר, הפתרון שלך עובר את דרישות המטלה."
    : "חניך יקר, הפתרון שלך לא עובר את דרישות המטלה.";
  if (score >= 100) {
    return `${gradeLine}\n\nכל הכבוד!`;
  }
  const imp = (improvement || "").trim();
  let impBody: string;
  if (!imp.startsWith("להבא")) {
    impBody = `להבא, ${imp.replace(/^[, ]+/, "")}`;
  } else {
    impBody = imp;
  }
  return `${gradeLine}\n\n${impBody}`;
}

/** Full summary text for the AI Summary panel (dynamic compose from AI text + current grade). */
export function getDisplayedStudentSummary(
  annotation: NonNullable<WorkspaceStudent["annotation"]>,
  commentLibrary: ProjectComment[],
): string {
  if (annotation.annotation_error) {
    return annotation.annotation_error;
  }
  const commentMap = new Map(commentLibrary.map((c) => [c.id, c]));
  const { score, passed } = computeAnnotationGrade(annotation.annotations, commentMap);
  return composeStudentSummary(annotation.ai_improvement, score, passed);
}

/** Sum of passed/total checks across every source that has a saved check run. */
export function sumCheckRunsAcrossSources(students: WorkspaceStudent[]): {
  passed: number;
  total: number;
} {
  let passed = 0;
  let total = 0;
  for (const s of students) {
    if (!s.check) continue;
    const pt = checkRunPassedTotal(s.check);
    passed += pt.passed;
    total += pt.total;
  }
  return { passed, total };
}
