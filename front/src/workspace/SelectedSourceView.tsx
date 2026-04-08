import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import {
  addProjectAnnotation,
  deleteProjectAnnotation,
  type ProjectComment,
  type RunCheckerResponse,
  type WorkspaceStudent,
} from "../api";
import { font } from "../MuiTheme.tsx";
import AnnotationReviewToolbar from "./AnnotationReviewToolbar";
import CheckRunResults from "./CheckRunResults";
import {
  checkRunPassedTotal,
  computeAnnotationGrade,
  getDisplayedStudentSummary,
} from "./checkRunStats";
import { getReviewQueueLineNumbers } from "./lineAnnotations";
import ReplaceStaleAnnotationDialog from "./ReplaceStaleAnnotationDialog";
import StudentCodeViewer from "./StudentCodeViewer";
import { AutoFixHighRounded, TerminalRounded } from "@mui/icons-material";

type Props = {
  student: WorkspaceStudent;
  projectId: string;
  /** Resolves `comment_id` on line annotations to message text. */
  commentLibrary: ProjectComment[];
  /** Called after annotations are mutated; may return a promise (e.g. workspace refresh). */
  onAnnotationsChanged?: () => void | Promise<void>;
  checkerScriptPresent: boolean;
  /** AI settings include an API key — required to run annotation. */
  canAnnotate: boolean;
  /** Disables action buttons while any workspace job runs (check all, single check, delete). */
  workspaceBusy: boolean;
  /** Spinner on “Check run this source” only while that request runs. */
  checkThisSourceRunning: boolean;
  /** Spinner on “Annotate this source” while that request runs. */
  annotateThisSourceRunning: boolean;
  deletePending: boolean;
  onCheckRunThisSource: () => void;
  onAnnotateThisSource: () => void;
  onDeleteSource: () => void;
};

function workspaceCheckToRunResult(
  check: NonNullable<WorkspaceStudent["check"]>,
): Extract<RunCheckerResponse, { ok: true }> {
  return {
    ok: true,
    exit_code: check.exit_code ?? null,
    output: check.output || "",
    check_cases: check.check_cases,
    passed: check.passed,
    total: check.total,
  };
}

function AnnotationGradeChip({
  student,
  commentLibrary,
}: {
  student: WorkspaceStudent;
  commentLibrary: ProjectComment[];
}) {
  if (!student.annotation?.annotations) return null;
  const commentMap = new Map(commentLibrary.map((c) => [c.id, c]));
  const { score, passed } = computeAnnotationGrade(student.annotation.annotations, commentMap);
  return (
    <Chip
      label={`Grade: ${score} / 100`}
      color={passed ? "success" : "error"}
      variant="outlined"
    />
  );
}

function CheckStatusChip({ student }: { student: WorkspaceStudent }) {
  const c = student.check;
  if (!c) return null;

  const { passed, total } = checkRunPassedTotal(c);

  const allOk = passed === total && total > 0;
  const partial = passed > 0 && passed < total;
  const label = `Checks passed: ${passed} / ${total}`;
  const color = allOk ? "success" : partial ? "warning" : "error";

  return <Chip label={label} color={color} variant="outlined" />;
}

export default function SelectedSourceView({
  student,
  projectId,
  commentLibrary,
  onAnnotationsChanged,
  checkerScriptPresent,
  canAnnotate,
  workspaceBusy,
  checkThisSourceRunning,
  annotateThisSourceRunning,
  deletePending,
  onCheckRunThisSource,
  onAnnotateThisSource,
  onDeleteSource,
}: Props) {
  const [checkPanelExpanded, setCheckPanelExpanded] = useState(false);
  const [summaryPanelExpanded, setSummaryPanelExpanded] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewReplaceOpen, setReviewReplaceOpen] = useState(false);
  const [reviewActionBusy, setReviewActionBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const lineCount = useMemo(() => {
    const c = student.code?.trim() ? student.code : "No source code available.";
    return c.split("\n").length;
  }, [student.code]);

  const reviewLineNumbers = useMemo(
    () =>
      getReviewQueueLineNumbers(
        student.annotation?.annotations,
        commentLibrary,
        lineCount,
      ),
    [student.annotation?.annotations, commentLibrary, lineCount],
  );

  const reviewQueueKey = useMemo(() => reviewLineNumbers.join(","), [reviewLineNumbers]);

  const canStartReview = reviewLineNumbers.length > 0 && !workspaceBusy;

  useEffect(() => {
    setCheckPanelExpanded(false);
    setSummaryPanelExpanded(true);
    setReviewMode(false);
    setReviewIndex(0);
    setReviewReplaceOpen(false);
    setReviewError(null);
  }, [student.filename]);

  useEffect(() => {
    if (!reviewMode) return;
    if (reviewLineNumbers.length === 0) {
      setReviewMode(false);
      setReviewIndex(0);
      return;
    }
    setReviewIndex((prev) => Math.min(prev, reviewLineNumbers.length - 1));
  }, [reviewMode, reviewQueueKey, reviewLineNumbers.length]);

  const exitReview = useCallback(() => {
    setReviewMode(false);
    setReviewIndex(0);
    setReviewReplaceOpen(false);
    setReviewError(null);
  }, []);

  const refreshAfterAnnotationChange = useCallback(async () => {
    await Promise.resolve(onAnnotationsChanged?.());
  }, [onAnnotationsChanged]);

  const handleReviewKeep = useCallback(() => {
    setReviewError(null);
    if (reviewIndex + 1 >= reviewLineNumbers.length) {
      exitReview();
      return;
    }
    setReviewIndex((i) => i + 1);
  }, [reviewIndex, reviewLineNumbers.length, exitReview]);

  const handleReviewBack = useCallback(() => {
    setReviewError(null);
    setReviewIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleReviewDelete = useCallback(async () => {
    const line = reviewLineNumbers[reviewIndex];
    if (line == null) return;
    setReviewError(null);
    setReviewActionBusy(true);
    try {
      const r = await deleteProjectAnnotation(projectId, {
        filename: student.filename,
        line,
      });
      if (!r.ok) {
        throw new Error(r.error || "Could not delete annotation.");
      }
      await refreshAfterAnnotationChange();
    } catch (e) {
      setReviewError((e as Error).message || "Could not delete annotation.");
    } finally {
      setReviewActionBusy(false);
    }
  }, [
    projectId,
    refreshAfterAnnotationChange,
    reviewIndex,
    reviewLineNumbers,
    student.filename,
  ]);

  const handleReviewReplacePick = useCallback(
    async (commentId: string) => {
      const line = reviewLineNumbers[reviewIndex];
      if (line == null) return;
      const r = await addProjectAnnotation(projectId, {
        filename: student.filename,
        line,
        commentId,
      });
      if (!r.ok) {
        throw new Error(r.error || "Could not update annotation.");
      }
      await refreshAfterAnnotationChange();
      setReviewReplaceOpen(false);
      if (reviewIndex + 1 >= reviewLineNumbers.length) {
        exitReview();
      } else {
        setReviewIndex((i) => i + 1);
      }
    },
    [
      exitReview,
      projectId,
      refreshAfterAnnotationChange,
      reviewIndex,
      reviewLineNumbers,
      student.filename,
    ],
  );

  const reviewFocusLine =
    reviewMode && reviewLineNumbers.length > 0
      ? reviewLineNumbers[Math.min(reviewIndex, reviewLineNumbers.length - 1)]
      : null;

  const checkTitle =
    student.check?.check_cases && student.check.check_cases.length > 0
      ? `Check run output (${student.check.passed ?? student.check.check_cases.filter((t) => t.passed).length} / ${student.check.total ?? student.check.check_cases.length} passed)`
      : "Check run output";

  const summaryText = useMemo(() => {
    const ann = student.annotation;
    if (!ann) return "";
    return getDisplayedStudentSummary(ann, commentLibrary);
  }, [student.annotation, commentLibrary]);

  return (
    <Paper elevation={4} square sx={{ width: "100%", height: "100%", pb: 0.5, pr: 0.5 }}>
      <Paper elevation={0} sx={{ width: "100%", height: "100%" }}>
        <Stack spacing={1} sx={{ p: 2, width: "100%", height: "100%" }}>
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            flexWrap="wrap"
            sx={{ columnGap: 1, rowGap: 0.5 }}
          >
            <Typography variant="h5" sx={{ fontFamily: font.monospace, mr: "auto" }}>
              {student.filename}
            </Typography>
            <AnnotationGradeChip student={student} commentLibrary={commentLibrary} />
            <CheckStatusChip student={student} />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              size="small"
              color="error"
              disabled={workspaceBusy}
              onClick={onDeleteSource}
              startIcon={
                deletePending ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <DeleteOutlineRoundedIcon />
                )
              }
            >
              Delete source
            </Button>
            <Button
              variant="contained"
              size="small"
              color="primary"
              disabled={!checkerScriptPresent || workspaceBusy}
              onClick={onCheckRunThisSource}
              startIcon={
                checkThisSourceRunning ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <TerminalRounded />
                )
              }
            >
              Check run this source
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={!canAnnotate || workspaceBusy}
              onClick={onAnnotateThisSource}
              startIcon={
                annotateThisSourceRunning ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <AutoFixHighRounded />
                )
              }
            >
              Annotate this source
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={!canStartReview || reviewMode}
              onClick={() => {
                setReviewError(null);
                setReviewIndex(0);
                setReviewMode(true);
              }}
              startIcon={<RateReviewRoundedIcon />}
            >
              Review annotations
            </Button>
          </Stack>

          {student.annotation && summaryText ? (
            <Accordion
              disableGutters
              expanded={summaryPanelExpanded}
              onChange={(_, v) => setSummaryPanelExpanded(v)}
              sx={{
                borderRadius: 1,
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 1.5, minHeight: 48 }}>
                <Typography variant="subtitle2">AI Summary</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
                <Box component="section" dir="rtl">
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1,
                      textAlign: "start",
                    }}
                  >
                    {summaryText}
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          ) : null}

          <StudentCodeViewer
            code={student.code || "No source code available."}
            annotations={student.annotation?.annotations}
            commentLibrary={commentLibrary}
            projectId={projectId}
            sourceFilename={student.filename}
            workspaceBusy={workspaceBusy}
            onAnnotationsChanged={onAnnotationsChanged}
            reviewMode={reviewMode}
            reviewFocusLine={reviewFocusLine}
          />

          {student.check ? (
            <Accordion
              disableGutters
              expanded={checkPanelExpanded}
              onChange={(_, v) => setCheckPanelExpanded(v)}
              sx={{
                borderRadius: 1,
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 1.5, minHeight: 48 }}>
                <Typography variant="subtitle2">{checkTitle}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
                <CheckRunResults result={workspaceCheckToRunResult(student.check)} />
              </AccordionDetails>
            </Accordion>
          ) : null}
        </Stack>
      </Paper>
      <AnnotationReviewToolbar
        open={reviewMode && reviewLineNumbers.length > 0}
        reviewIndex={reviewIndex}
        total={reviewLineNumbers.length}
        disabled={workspaceBusy || reviewActionBusy}
        replaceDisabled={commentLibrary.length === 0}
        onKeep={handleReviewKeep}
        onBack={handleReviewBack}
        backDisabled={reviewIndex <= 0}
        onReplace={() => {
          setReviewError(null);
          setReviewReplaceOpen(true);
        }}
        onDelete={() => void handleReviewDelete()}
        onExitReview={exitReview}
        error={reviewError}
        onClearError={() => setReviewError(null)}
      />
      <ReplaceStaleAnnotationDialog
        open={reviewReplaceOpen}
        lineNum={reviewLineNumbers[reviewIndex] ?? 0}
        comments={commentLibrary}
        disabled={workspaceBusy || reviewActionBusy}
        mode="review"
        onClose={() => setReviewReplaceOpen(false)}
        onPick={handleReviewReplacePick}
      />
    </Paper>
  );
}
