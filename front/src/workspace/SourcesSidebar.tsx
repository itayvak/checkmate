import { useMemo } from "react";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import type { ProjectComment, WorkspaceStudent } from "../api";
import SourceAnnotationBadge from "./SourceAnnotationBadge";
import SourceCheckBadge from "./SourceCheckBadge";
import { computeAnnotationGrade, sumCheckRunsAcrossSources } from "./checkRunStats";
import { AssessmentRounded, SchoolRounded } from "@mui/icons-material";

type Props = {
  students: WorkspaceStudent[];
  selectedFilename: string | null;
  uploading: boolean;
  /** When true, the upload dialog is open (sidebar button stays disabled). */
  uploadDialogOpen: boolean;
  commentLibrary: ProjectComment[];
  onSelectFilename: (filename: string) => void;
  onOpenUploadSources: () => void;
  onOpenCheckMatrix: () => void;
  onOpenGradesSummary: () => void;
};

export default function SourcesSidebar(props: Props) {
  const checkTotals = useMemo(
    () => sumCheckRunsAcrossSources(props.students),
    [props.students],
  );
  const checkPassPercent =
    checkTotals.total > 0 ? Math.round((checkTotals.passed / checkTotals.total) * 100) : null;

  const annotationCounts = useMemo(() => {
    let annotated = 0;
    let gradePassed = 0;
    let gradeFailed = 0;
    const commentMap = new Map(props.commentLibrary.map((c) => [c.id, c]));
    for (const s of props.students) {
      if (s.annotation != null) {
        annotated += 1;
        if (s.annotation.annotations) {
          const { passed } = computeAnnotationGrade(s.annotation.annotations, commentMap);
          if (passed) gradePassed += 1;
          else gradeFailed += 1;
        }
      }
    }
    const total = props.students.length;
    return { annotated, total, gradePassed, gradeFailed };
  }, [props.students, props.commentLibrary]);

  return (
    <Paper
      square
      elevation={4}
      sx={{
        width: 280,
        minWidth: 280,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          Sources
        </Typography>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={0.75}
          sx={{ mt: 0.5 }}
        >
          <Stack spacing={0.15} sx={{ minWidth: 0 }}>
            <Typography variant="body2" component="span">
              {props.students.length} total sources
            </Typography>
            {props.students.length > 0 ? (
              <>
                {checkPassPercent !== null ? (
                  <Typography variant="body2" component="span" sx={{ px: 1 }}>
                    {checkPassPercent}% checks passed
                  </Typography>
                ) : (
                  <Typography variant="body2" component="span">
                    No check runs yet
                  </Typography>
                )}
                <Typography variant="body2" component="span">
                  {annotationCounts.annotated} annotated
                </Typography>
                { annotationCounts.annotated > 0 &&
                <Typography variant="body2" component="span" sx={{ px: 1 }}>
                  {Math.round((annotationCounts.gradePassed / annotationCounts.annotated) * 100)}% passed
                </Typography>
                }
              </>
            ) : null}
          </Stack>
          {props.students.length > 0 ? (
            <Stack direction="row" spacing={0} sx={{ flexShrink: 0, mr: -0.75, mt: -0.25 }}>
              <Tooltip title="Open check results matrix">
                <IconButton size="small" aria-label="Open check results matrix" onClick={props.onOpenCheckMatrix}>
                  <AssessmentRounded fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open grades summary">
                <IconButton size="small" aria-label="Open grades summary" onClick={props.onOpenGradesSummary}>
                  <SchoolRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Stack>
      </Box>

      <List dense sx={{ flex: 1, overflow: "auto" }}>
        {props.students.map((s) => (
          <ListItemButton
            key={s.filename}
            selected={s.filename === props.selectedFilename}
            onClick={() => props.onSelectFilename(s.filename)}
            sx={{
              alignItems: "center",
              gap: 0.75,
              py: 0.75,
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}
            >
              {s.filename}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
              <SourceCheckBadge check={s.check} />
              <SourceAnnotationBadge annotation={s.annotation} commentLibrary={props.commentLibrary} />
            </Stack>
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ p: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<UploadFileRoundedIcon />}
          disabled={props.uploading || props.uploadDialogOpen}
          onClick={props.onOpenUploadSources}
        >
          Upload source files
        </Button>
      </Box>
    </Paper>
  );
}

