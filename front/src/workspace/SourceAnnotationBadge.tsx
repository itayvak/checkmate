import { Box, Tooltip } from "@mui/material";
import type { ProjectComment, WorkspaceStudent } from "../api";
import { CloseRounded, CommentRounded } from "@mui/icons-material";
import { computeAnnotationGrade } from "./checkRunStats";
import { useTheme } from "@mui/material";

type Props = {
  annotation: WorkspaceStudent["annotation"];
  commentLibrary?: ProjectComment[];
};

export default function SourceAnnotationBadge({ annotation, commentLibrary }: Props) {
  const theme = useTheme();
  let tooltipTitle: string;
  let fillPercent: number;
  let fillKind: "gradedPass" | "gradedFail" | "neutral" | "none";

  if (annotation == null) {
    tooltipTitle = "No annotation yet";
    fillPercent = 0;
    fillKind = "none";
  } else if (commentLibrary && annotation.annotations) {
    const commentMap = new Map(commentLibrary.map((c) => [c.id, c]));
    const result = computeAnnotationGrade(annotation.annotations, commentMap);
    tooltipTitle = `${result.score} / 100 — ${result.passed ? "Pass" : "Fail"}`;
    fillPercent = result.score;
    fillKind = result.passed ? "gradedPass" : "gradedFail";
  } else {
    tooltipTitle = "Annotated";
    fillPercent = 100;
    fillKind = "neutral";
  }

  const fillBg =
    fillKind === "gradedPass"
      ? theme.palette.success.main
      : fillKind === "gradedFail"
        ? theme.palette.error.main
        : "transparent";

  return (
    <Tooltip title={tooltipTitle}>
      <Box
        component="span"
        aria-label={tooltipTitle}
        sx={{
          position: "relative",
          width: 15,
          height: 15,
          borderRadius: "50%",
          flexShrink: 0,
          bgcolor: "action.selected",
          overflow: "hidden",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {fillKind === "gradedPass" || fillKind === "gradedFail" ? (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: `${fillPercent}%`,
              bgcolor: fillBg,
              transition: (theme) =>
                theme.transitions.create(["height", "background-color"], {
                  duration: theme.transitions.duration.shorter,
                }),
            }}
          />
        ) : null}
        <Box
          component="span"
          sx={{
            position: "relative",
            zIndex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
          }}
        >
          {annotation == null ? (
            <CloseRounded sx={{ fontSize: 9 }} />
          ) : (
            <CommentRounded sx={{ fontSize: 9 }} />
          )}
        </Box>
      </Box>
    </Tooltip>
  );
}
