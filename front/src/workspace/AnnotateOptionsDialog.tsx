import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with optional extra instructions when the user starts. */
  onStart: (extraInstructions: string) => void;
};

export default function AnnotateOptionsDialog({ open, onClose, onStart }: Props) {
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (!open) setExtra("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Annotate this source</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Uses your API key and model from AI settings.
          </Typography>
          <TextField
            label="Extra instructions (optional)"
            placeholder="e.g. Focus on edge cases for empty input. Keep feedback short."
            multiline
            minRows={3}
            fullWidth
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onStart(extra.trim())}>
          Start
        </Button>
      </DialogActions>
    </Dialog>
  );
}
