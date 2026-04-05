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

export type CheckRunAllProgress = {
  total: number;
  doneCount: number;
  currentFilename: string;
};

type Props = {
  open: boolean;
  progress: CheckRunAllProgress | null;
  onCancel: () => void;
};

export default function CheckRunAllDialog({ open, progress, onCancel }: Props) {
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
      <DialogTitle>Check run</DialogTitle>
      <DialogContent>
        {progress ? (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Checking{" "}
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
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={onCancel}>
          Cancel checking
        </Button>
      </DialogActions>
    </Dialog>
  );
}
