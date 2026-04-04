import { useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { CheckRounded, CloseRounded, RemoveRounded } from "@mui/icons-material";
import type { WorkspaceStudent } from "../api";
import { font } from "../MuiTheme.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  students: WorkspaceStudent[];
};

function legacyOverallPassed(check: NonNullable<WorkspaceStudent["check"]>): boolean {
  if (check.check_cases && check.check_cases.length > 0) return false;
  return check.exit_code === 0;
}

function studentCasePassedAt(
  student: WorkspaceStudent,
  colIndex: number,
  hasStructuredColumns: boolean,
): "pass" | "fail" | "empty" | "legacy_only" {
  const c = student.check;
  if (!c) return "empty";

  const cases = c.check_cases;
  if (cases && cases.length > 0) {
    if (colIndex >= cases.length) return "empty";
    const passed = cases[colIndex].passed;
    return passed === true ? "pass" : passed === false ? "fail" : "empty";
  }

  if (!hasStructuredColumns && colIndex === 0) {
    return legacyOverallPassed(c) ? "pass" : "fail";
  }

  return "legacy_only";
}

function CellIcon({ kind }: { kind: "pass" | "fail" | "empty" | "legacy_only" }) {
  if (kind === "pass") {
    return <CheckRounded sx={{ fontSize: 18, color: "success.main" }} aria-label="Passed" />;
  }
  if (kind === "fail") {
    return <CloseRounded sx={{ fontSize: 18, color: "error.main" }} aria-label="Failed" />;
  }
  if (kind === "legacy_only") {
    return (
      <Tooltip title="Run check again for per-case results">
        <RemoveRounded sx={{ fontSize: 18, color: "text.disabled" }} aria-label="No per-case data" />
      </Tooltip>
    );
  }
  return (
    <Typography component="span" color="text.disabled" sx={{ fontSize: 13 }}>
      —
    </Typography>
  );
}

export default function CheckRunMatrixDialog({ open, onClose, students }: Props) {
  const { columnLabels, rows, footerCounts } = useMemo(() => {
    const maxLen = Math.max(
      0,
      ...students.map((s) => s.check?.check_cases?.length ?? 0),
    );
    const hasStructured = maxLen > 0;

    const labels: string[] = [];
    if (hasStructured) {
      for (let i = 0; i < maxLen; i++) {
        let title: string | undefined;
        for (const s of students) {
          const name = s.check?.check_cases?.[i]?.name;
          if (name && String(name).trim()) {
            title = String(name).trim();
            break;
          }
        }
        labels.push(title || `Check ${i + 1}`);
      }
    } else {
      labels.push("Overall");
    }

    const rowData = students.map((student) => {
      const cells: Array<"pass" | "fail" | "empty" | "legacy_only"> = [];
      const colCount = hasStructured ? maxLen : 1;
      for (let j = 0; j < colCount; j++) {
        cells.push(studentCasePassedAt(student, j, hasStructured));
      }
      return { student, cells };
    });

    const footer = labels.map((_, colIndex) => {
      let passed = 0;
      let total = 0;
      for (const r of rowData) {
        const k = r.cells[colIndex];
        if (k === "pass" || k === "fail") {
          total += 1;
          if (k === "pass") passed += 1;
        }
      }
      return { passed, total };
    });

    return {
      columnLabels: labels,
      rows: rowData,
      footerCounts: footer,
    };
  }, [students]);

  const anyCheckData = students.some((s) => s.check);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>Check results by source</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Displays the results of all checker runs for each source.
        </DialogContentText>
        {!anyCheckData ? (
          <Typography variant="body2" color="text.secondary">
            No check runs yet. Run &quot;Check run all&quot; or check a single source first.
          </Typography>
        ) : (
          <TableContainer
            sx={{
              maxHeight: "min(70vh, 560px)",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      minWidth: 160,
                      maxWidth: 280,
                      backgroundColor: "background.paper",
                      boxShadow: (t) => `1px 0 ${t.palette.divider}`,
                      fontFamily: font.monospace,
                    }}
                  >
                    Source
                  </TableCell>
                  {columnLabels.map((label, idx) => (
                    <TableCell
                      key={`h-${idx}`}
                      align="center"
                      sx={{
                        minWidth: 96,
                        maxWidth: 200,
                        verticalAlign: "bottom",
                        whiteSpace: "normal",
                        lineHeight: 1.2,
                      }}
                    >
                      {label.length > 40 ? (
                        <Tooltip title={label} placement="top">
                          <span>{`${label.slice(0, 38)}…`}</span>
                        </Tooltip>
                      ) : (
                        <span>{label}</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ student, cells }) => (
                  <TableRow key={student.filename} hover>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                        backgroundColor: "background.paper",
                        boxShadow: (t) => `1px 0 ${t.palette.divider}`,
                        fontFamily: font.monospace,
                        fontSize: 13,
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Tooltip title={student.filename}>
                        <span>{student.filename}</span>
                      </Tooltip>
                    </TableCell>
                    {cells.map((kind, idx) => (
                      <TableCell key={`c-${idx}`} align="center" sx={{ py: 0.75 }}>
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                          <CellIcon kind={kind} />
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      backgroundColor: "action.hover",
                      boxShadow: (t) => `1px 0 ${t.palette.divider}`,
                    }}
                  >
                    Passed this case
                  </TableCell>
                  {footerCounts.map((fc, idx) => (
                    <TableCell key={`f-${idx}`} align="center" sx={{ backgroundColor: "action.hover" }}>
                      {fc.total > 0 ? (
                        <Typography variant="body2">
                          {Math.round((fc.passed / fc.total) * 100)}%
                        </Typography>
                      ) : null}
                      <Typography variant="caption" >
                        {fc.total === 0 ? "—" : `${fc.passed}/${fc.total}`}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
