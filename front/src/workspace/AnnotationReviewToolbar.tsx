import { Alert, Box, Button, IconButton, Paper, Slide, Stack, Typography } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { useAppColors, borderRadius } from "../MuiTheme";
import CloseRounded from "@mui/icons-material/CloseRounded";

type Props = {
  /** Animate visibility; keep mounted while exiting so the slide-out can finish. */
  open: boolean;
  /** 0-based index of the annotation being reviewed */
  reviewIndex: number;
  total: number;
  disabled: boolean;
  replaceDisabled: boolean;
  onKeep: () => void;
  onBack: () => void;
  /** No previous annotation in the queue */
  backDisabled?: boolean;
  onReplace: () => void;
  onDelete: () => void;
  onExitReview: () => void;
  error?: string | null;
  onClearError?: () => void;
};

export default function AnnotationReviewToolbar({
  open,
  reviewIndex,
  total,
  disabled,
  replaceDisabled,
  onKeep,
  onBack,
  backDisabled = false,
  onReplace,
  onDelete,
  onExitReview,
  error,
  onClearError,
}: Props) {
  const progressLabel =
    total > 0 ? `Annotation ${reviewIndex + 1} of ${total}` : "0 of 0";
  const colors = useAppColors();
  return (
    <Slide in={open} direction="up" mountOnEnter unmountOnExit timeout={200}>
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 16,
          zIndex: 1500,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          px: 1.5,
          pb: "max(12px, env(safe-area-inset-bottom))",
          pointerEvents: "none",
        }}
      >
        <Paper
          sx={{
            borderRadius: "50px",
            backgroundColor: colors.surfaceContainer,
            pointerEvents: "auto",
            width: "fit-content",
            maxWidth: "100%",
            p: 1.5,
          }}
        >
          <Stack spacing={1} alignItems="stretch">
            {error ? (
              <Alert severity="error" onClose={onClearError} sx={{ borderRadius: borderRadius.full }}>
                {error}
              </Alert>
            ) : null}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              gap={2}
            >
              <Stack direction="row" alignItems="center" gap={0}>
                <IconButton color="inherit" onClick={onExitReview} disabled={disabled}>
                  <CloseRounded />
                </IconButton>
                <Typography variant="body2" sx={{ alignSelf: "center" }}>
                  {progressLabel}
                </Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={0.5} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={onBack}
                  disabled={disabled || backDisabled}
                  startIcon={<ArrowBackRounded />}
                >
                  Back
                </Button>
                <Button variant="outlined" color="error" onClick={onDelete} disabled={disabled} startIcon={<DeleteRounded />}>
                  Delete
                </Button>
                <Button
                  variant="outlined"
                  onClick={onReplace}
                  disabled={disabled || replaceDisabled}
                  startIcon={<SyncRounded />}
                >
                  Replace
                </Button>
                <Button variant="contained" onClick={onKeep} disabled={disabled} startIcon={<CheckRounded />}>
                  Keep &amp; continue
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Slide>
  );
}
