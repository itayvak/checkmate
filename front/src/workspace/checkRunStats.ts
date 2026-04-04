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
 * Grade = 100 − sum of point deductions for each applied annotation.
 * Pass threshold: grade ≥ 70.
 */
export function computeAnnotationGrade(
  annotations: LineAnnotation[] | undefined,
  commentMap: Map<string, ProjectComment>,
): { score: number; passed: boolean } {
  if (!annotations || annotations.length === 0) {
    return { score: 100, passed: true };
  }
  let deduction = 0;
  for (const ann of annotations) {
    const cid = ann.comment_id;
    if (cid) {
      const comment = commentMap.get(cid);
      if (comment) {
        deduction += comment.points ?? 0;
      }
    }
  }
  const score = Math.max(0, 100 - deduction);
  return { score, passed: score >= 70 };
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
