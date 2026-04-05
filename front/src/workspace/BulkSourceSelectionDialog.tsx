import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";

export type BulkSelectionMode = "check" | "annotate";

type Props = {
  open: boolean;
  mode: BulkSelectionMode;
  filenames: string[];
  onClose: () => void;
  /** For check mode, extraInstructions is always an empty string. */
  onConfirm: (selectedFilenames: string[], extraInstructions: string) => void;
};

export default function BulkSourceSelectionDialog({
  open,
  mode,
  filenames,
  onClose,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (!open) {
      setExtra("");
      return;
    }
    setSelected(new Set(filenames));
  }, [open, filenames]);

  const selectedCount = filenames.filter((f) => selected.has(f)).length;
  const allSelected = filenames.length > 0 && selectedCount === filenames.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleFile = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const allOn = filenames.length > 0 && filenames.every((f) => prev.has(f));
      if (allOn) return new Set();
      return new Set(filenames);
    });
  }, [filenames]);

  const title = mode === "check" ? "Check run on sources" : "Annotate sources";
  const primaryLabel = mode === "check" ? "Check run" : "Annotate";

  const handleConfirm = () => {
    const list = filenames.filter((f) => selected.has(f));
    onConfirm(list, extra.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1}}>
        {mode === "annotate" ? (
          <>
            <DialogContentText>
              Uses your API key and model from AI settings.
            </DialogContentText>
            <TextField
              label="Extra instructions (optional)"
              placeholder="e.g. Focus on edge cases for empty input. Keep feedback short."
              multiline
              minRows={3}
              fullWidth
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </>
        ) : null}
        {mode === "check" ? (
          <>
            <DialogContentText>
              Uses the checker script defined
            </DialogContentText>
          </>
        ) : null}

        <FormControlLabel
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleSelectAll}
            />
          }
          label="Select all"
        />

        <List
          dense
          sx={{
            maxHeight: 360,
            overflow: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            p: 1
          }}
        >
          {filenames.map((name) => (
            <ListItem key={name} disablePadding>
              <ListItemIcon sx={{ minWidth: 42 }}>
                <Checkbox
                  edge="start"
                  tabIndex={-1}
                  disableRipple
                  checked={selected.has(name)}
                  onChange={() => toggleFile(name)}
                />
              </ListItemIcon>
              <ListItemText
                primary={name}
                primaryTypographyProps={{
                  variant: "body2",
                  sx: {
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  },
                }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={selectedCount === 0}>
          {primaryLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
