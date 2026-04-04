import { Box, Tooltip } from "@mui/material";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CircleOutlined from "@mui/icons-material/CircleOutlined";
import type { WorkspaceStudent } from "../api";
import { useAppColors } from "../MuiTheme";

type Props = {
  check: WorkspaceStudent["check"];
};

export default function SourceCheckBadge({ check }: Props) {
  const colors = useAppColors();

  if (check == null) {
    return (
      <Tooltip title="No check run yet">
        <Box
          component="span"
          sx={{
            width: 15,
            height: 15,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            bgcolor: "action.selected",
            color: "text.secondary",
          }}
        >
          <CircleOutlined sx={{ fontSize: 9 }} />
        </Box>
      </Tooltip>
    );
  }

  const cases = check.check_cases;
  if (cases && cases.length > 0) {
    const passed = check.passed ?? cases.filter((c) => c.passed).length;
    const total = check.total ?? cases.length;
    return (
      <Tooltip title={`${passed}/${total} checks passed`}>
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
            height: 13,
            px: 0.2,
            py: "1px",
            border: 1,
            borderColor: "divider",
            borderRadius: 999,
            bgcolor: "action.hover",
            flexShrink: 0,
          }}
        >
          {cases.map((tc, idx) => (
            <Box
              component="span"
              key={`${tc.name ?? "case"}-${idx}`}
              title={tc.name || `Case ${idx + 1}`}
              sx={{
                width: 2,
                height: 6,
                borderRadius: 999,
                flexShrink: 0,
                bgcolor: tc.passed ? colors.success : colors.error,
              }}
            />
          ))}
        </Box>
      </Tooltip>
    );
  }

  if (check.exit_code === 0) {
    return (
      <Tooltip title="Check run passed">
        <Box
          component="span"
          sx={{
            width: 15,
            height: 15,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            bgcolor: colors.successContainer,
            color: colors.onSuccessContainer,
          }}
        >
          <CheckRounded sx={{ fontSize: 11 }} />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Check run failed">
      <Box
        component="span"
        sx={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          bgcolor: colors.errorContainer,
          color: colors.onErrorContainer,
        }}
      >
        <CloseRounded sx={{ fontSize: 11 }} />
      </Box>
    </Tooltip>
  );
}
