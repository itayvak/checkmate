import { useMemo } from "react";
import {
  Box,
  Button,
  Chip,
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
import { CheckRounded, CloseRounded } from "@mui/icons-material";
import type { ProjectComment, WorkspaceStudent } from "../api";
import { font } from "../MuiTheme.tsx";
import { computeAnnotationGrade } from "./checkRunStats";

type Props = {
  open: boolean;
  onClose: () => void;
  students: WorkspaceStudent[];
  commentLibrary: ProjectComment[];
};

type RowModel = {
  student: WorkspaceStudent;
  score: number | null;
  passed: boolean | null;
};

function buildRows(students: WorkspaceStudent[], commentMap: Map<string, ProjectComment>): RowModel[] {
  return students.map((student) => {
    if (student.annotation == null) {
      return { student, score: null, passed: null };
    }
    const { score, passed } = computeAnnotationGrade(student.annotation.annotations, commentMap);
    return { student, score, passed };
  });
}

export default function GradesSummaryDialog({ open, onClose, students, commentLibrary }: Props) {
  const commentMap = useMemo(
    () => new Map(commentLibrary.map((c) => [c.id, c])),
    [commentLibrary],
  );

  const { rows, footer } = useMemo(() => {
    const r = buildRows(students, commentMap);
    const graded = r.filter((x) => x.score !== null);
    const passCount = graded.filter((x) => x.passed).length;
    const avg =
      graded.length > 0
        ? Math.round(graded.reduce((s, x) => s + (x.score as number), 0) / graded.length)
        : null;
    return {
      rows: r,
      footer: {
        annotated: graded.length,
        total: students.length,
        passCount,
        avg,
      },
    };
  }, [students, commentMap]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Grades by source</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Pass is a score of 70 or higher, sources without annotations yet show a dash.
        </DialogContentText>
        {students.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No sources uploaded.
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
                  <TableCell align="center" sx={{ minWidth: 88 }}>
                    Grade
                  </TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>
                    Result
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ student, score, passed }) => (
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
                    <TableCell align="center">
                      {score === null ? (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      ) : (
                        <Typography variant="body2" fontWeight={500}>
                          {score}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {passed === null ? (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      ) : passed ? (
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <Chip
                            size="small"
                            icon={<CheckRounded />}
                            label="Pass"
                            color="success"
                            variant="outlined"
                            sx={{ "& .MuiChip-icon": { color: "success.main" } }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <Chip
                            size="small"
                            icon={<CloseRounded />}
                            label="Fail"
                            color="error"
                            variant="outlined"
                            sx={{ "& .MuiChip-icon": { color: "error.main" } }}
                          />
                        </Box>
                      )}
                    </TableCell>
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
                    Summary
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: "action.hover" }}>
                    {footer.annotated > 0 && footer.avg !== null ? (
                      <Typography variant="body2">Average grade: {footer.avg}</Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: "action.hover" }}>
                    {footer.annotated > 0 ? (
                      <Typography variant="body2">
                        {Math.round((footer.passCount / footer.annotated) * 100)}% passed
                        <Typography component="span" variant="caption" display="block" color="text.secondary">
                          {footer.passCount}/{footer.annotated}
                        </Typography>
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No annotations yet
                      </Typography>
                    )}
                  </TableCell>
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
