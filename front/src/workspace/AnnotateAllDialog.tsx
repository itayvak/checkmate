import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { CheckRunAllProgress } from "./CheckRunAllDialog";

type Props = {
  open: boolean;
  progress: CheckRunAllProgress | null;
  onCancel: () => void;
};

export default function AnnotateAllDialog({ open, progress, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick") return;
        onCancel();
      }}
      disableEscapeKeyDown={false}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Annotate all</DialogTitle>
      <DialogContent>
        {progress ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Annotating{" "}
              {progress.doneCount < progress.total ? progress.doneCount + 1 : progress.total} of{" "}
              {progress.total}…
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
              {progress.currentFilename}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress.total > 0 ? (progress.doneCount / progress.total) * 100 : 0}
            />
            <Typography variant="caption" color="text.secondary">
              Cancel stops before the next file, the current request may still finish.
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
