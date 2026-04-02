import { useEffect, useState } from "react";
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
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Editor from "@monaco-editor/react";
import type { RunCheckerResponse, WorkspaceStudent } from "../api";
import { colors, font } from "../MuiTheme.tsx";
import CheckRunResults from "./CheckRunResults";

type Props = {
  student: WorkspaceStudent;
  checkerScriptPresent: boolean;
  /** Disables action buttons while any workspace job runs (check all, single check, delete). */
  workspaceBusy: boolean;
  /** Spinner on “Check run this source” only while that request runs. */
  checkThisSourceRunning: boolean;
  deletePending: boolean;
  onCheckRunThisSource: () => void;
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

function gradeLabel(grade: string) {
  if (grade === "pass") return "Pass";
  if (grade === "fail") return "Fail";
  return grade;
}

function CheckStatusChip({ student }: { student: WorkspaceStudent }) {
  const c = student.check;
  if (!c) return null;

  let passed = 0;
  let total = 1;
  if (c.check_cases && c.check_cases.length > 0) {
    total = c.total ?? c.check_cases.length;
    passed = c.passed ?? c.check_cases.filter((t) => t.passed).length;
  } else if (c.exit_code === 0) {
    passed = 1;
  }

  const allOk = passed === total && total > 0;
  const partial = passed > 0 && passed < total;
  const label = `${passed} / ${total} Checks passed`;
  const color = allOk ? "success" : partial ? "warning" : "error";

  return <Chip label={label} color={color} variant="outlined" />;
}

export default function SelectedSourceView({
  student,
  checkerScriptPresent,
  workspaceBusy,
  checkThisSourceRunning,
  deletePending,
  onCheckRunThisSource,
  onDeleteSource,
}: Props) {
  const monacoThemeName = "checkmate-student-code";
  const [checkPanelExpanded, setCheckPanelExpanded] = useState(false);

  useEffect(() => {
    setCheckPanelExpanded(false);
  }, [student.filename]);

  const checkTitle =
    student.check?.check_cases && student.check.check_cases.length > 0
      ? `Check run output (${student.check.passed ?? student.check.check_cases.filter((t) => t.passed).length} / ${student.check.total ?? student.check.check_cases.length} passed)`
      : "Check run output";

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
            {student.annotation?.grade ? (
              <Chip
                label={gradeLabel(student.annotation.grade)}
                color={student.annotation.grade === "pass" ? "success" : student.annotation.grade === "fail" ? "error" : "default"}
                variant="outlined"
              />
            ) : null}
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
                  <PlayArrowRoundedIcon />
                )
              }
            >
              Check run this source
            </Button>
          </Stack>

          {student.annotation?.summary && (
            <Paper elevation={1} sx={{ p: 1.5 }}>
              {student.annotation.summary}
            </Paper>
          )}

          <Paper elevation={1} sx={{ flexGrow: 1, overflow: "hidden", p: 0.5, minHeight: 200 }}>
            <Editor
              height="100%"
              defaultLanguage="python"
              language="python"
              beforeMount={(monaco) => {
                monaco.editor.defineTheme(monacoThemeName, {
                  base: "vs-dark",
                  inherit: true,
                  rules: [],
                  colors: {
                    "editor.background": colors.surfaceContainerLow,
                  },
                });
              }}
              theme={monacoThemeName}
              value={student.code || "No source code available."}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </Paper>

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
