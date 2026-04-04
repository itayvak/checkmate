import { useEffect, useMemo, useState } from "react";
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
import type { ProjectComment, RunCheckerResponse, WorkspaceStudent } from "../api";
import { font } from "../MuiTheme.tsx";
import CheckRunResults from "./CheckRunResults";
import {
  checkRunPassedTotal,
  computeAnnotationGrade,
  getDisplayedStudentSummary,
} from "./checkRunStats";
import StudentCodeViewer from "./StudentCodeViewer";
import { AutoFixHighRounded, TerminalRounded } from "@mui/icons-material";

type Props = {
  student: WorkspaceStudent;
  projectId: string;
  /** Resolves `comment_id` on line annotations to message text. */
  commentLibrary: ProjectComment[];
  /** Called after a stale annotation is replaced so workspace data can refresh. */
  onAnnotationsChanged?: () => void;
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

  useEffect(() => {
    setCheckPanelExpanded(false);
    setSummaryPanelExpanded(true);
  }, [student.filename]);

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
    </Paper>
  );
}
