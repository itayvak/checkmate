import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import type { ProjectComment } from "../api";

type Props = {
  open: boolean;
  lineNum: number;
  comments: ProjectComment[];
  disabled: boolean;
  /** `stale`: broken library link. `review`: teacher chose Replace in review mode. */
  mode?: "stale" | "review";
  onClose: () => void;
  onPick: (commentId: string) => Promise<void>;
};

export default function ReplaceStaleAnnotationDialog({
  open,
  lineNum,
  comments,
  disabled,
  mode = "stale",
  onClose,
  onPick,
}: Props) {
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...comments].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }),
    );
    if (!q) return sorted;
    return sorted.filter((c) => {
      const t = `${c.title || ""} ${c.details || ""}`.toLowerCase();
      return t.includes(q);
    });
  }, [comments, query]);

  const handlePick = async (commentId: string) => {
    if (disabled || picking) return;
    setPicking(true);
    setError(null);
    try {
      await onPick(commentId);
    } catch (e) {
      setError((e as Error).message || "Could not update annotation.");
    } finally {
      setPicking(false);
    }
  };

  const body =
    mode === "review" ? (
      <>
        Line {lineNum}: choose a comment from your library to replace this annotation.
      </>
    ) : (
      <>
        Line {lineNum}: the linked library comment was deleted. Choose a comment from your library to
        replace it.
      </>
    );

  return (
    <Dialog open={open} onClose={picking ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Replace annotation</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {body}
        </Typography>
        {comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Add comments under Settings → Comment library first.
          </Typography>
        ) : (
          <>
            <TextField
              size="small"
              fullWidth
              placeholder="Search comments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ mb: 1 }}
              disabled={picking}
            />
            {error ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {error}
              </Alert>
            ) : null}
            <List dense disablePadding sx={{ maxHeight: 360, overflow: "auto" }}>
              {filtered.map((c) => (
                <ListItemButton
                  key={c.id}
                  disabled={disabled || picking}
                  onClick={() => void handlePick(c.id)}
                >
                  <ListItemText
                    primary={c.title || "(no title)"}
                    secondary={c.details?.trim() ? c.details : undefined}
                    secondaryTypographyProps={{ sx: { whiteSpace: "pre-wrap" } }}
                  />
                </ListItemButton>
              ))}
            </List>
            {filtered.length === 0 && query.trim() ? (
              <Typography variant="caption" color="text.secondary">
                No comments match your search.
              </Typography>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={picking}>
          Cancel
        </Button>
        {picking ? <CircularProgress size={22} sx={{ mr: 1 }} /> : null}
      </DialogActions>
    </Dialog>
  );
}
