import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { font } from "../MuiTheme";

type Props = {
  open: boolean;
  filename: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteSourceConfirmDialog({
  open,
  filename,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (loading) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onCancel();
        }
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Delete this source?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          This removes the file from the project and deletes its saved check-run and annotation data.
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: font.monospace, wordBreak: "break-all" }}>
          {filename || "—"}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={loading || !filename}
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
