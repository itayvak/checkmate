import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import {
  createProjectComment,
  deleteProjectComment,
  listProjectComments,
  updateProjectComment,
  type ProjectComment,
} from "../api";
import { font } from "../MuiTheme";

type Props = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  /** Called after list changes so workspace data can stay in sync. */
  onLibraryUpdated?: () => void;
};

function previewText(text: string, maxLen = 140) {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "(empty message)";
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

type EditDialogProps = {
  open: boolean;
  projectId: string;
  isNew: boolean;
  comment: ProjectComment | null;
  onClose: () => void;
  onSaved: (c: ProjectComment) => void;
  onDeleted: (id: string) => void;
};

function CommentEditDialog({
  open,
  projectId,
  isNew,
  comment,
  onClose,
  onSaved,
  onDeleted,
}: EditDialogProps) {
  const [message, setMessage] = useState("");
  const [teacherText, setTeacherText] = useState("");
  const [points, setPoints] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedId = comment?.id ?? null;
  const canDelete = Boolean(selectedId) && !isNew;

  useEffect(() => {
    if (!open) return;
    if (isNew || !comment) {
      setMessage("");
      setTeacherText("");
      setPoints(0);
    } else {
      setMessage(comment.message || "");
      setTeacherText(comment.teacher_text || "");
      setPoints(comment.points ?? 0);
    }
    setFormError(null);
    setDeleteOpen(false);
  }, [open, isNew, comment]);

  const handleSave = async () => {
    const msg = message.trim();
    if (!msg) {
      setFormError("Student-facing message is required.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const pts = Math.max(0, Math.round(points || 0));
      if (isNew || !selectedId) {
        const json = await createProjectComment(projectId, {
          message: msg,
          teacher_text: teacherText.trim(),
          points: pts,
        });
        if (!json.ok) {
          setFormError(json.error || "Could not create comment.");
          return;
        }
        onSaved(json.comment);
      } else {
        const json = await updateProjectComment(projectId, selectedId, {
          message: msg,
          teacher_text: teacherText.trim(),
          points: pts,
        });
        if (!json.ok) {
          setFormError(json.error || "Could not save.");
          return;
        }
        onSaved(json.comment);
      }
    } catch (e) {
      setFormError((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const json = await deleteProjectComment(projectId, selectedId);
      if (!json.ok) {
        setFormError(json.error || "Delete failed.");
        return;
      }
      setDeleteOpen(false);
      onDeleted(selectedId);
    } catch (e) {
      setFormError((e as Error).message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(_, reason) => {
          if (saving || deleting) return;
          if (reason === "backdropClick" || reason === "escapeKeyDown") onClose();
        }}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle>{isNew ? "New comment" : "Edit comment"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {isNew || !selectedId ? "New entry" : "Comment ID"}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontFamily: font.monospace, wordBreak: "break-all", mt: 0.25 }}
              >
                {isNew || !selectedId ? "—" : selectedId}
              </Typography>
            </Box>

            <TextField
              label="Student-facing message"
              placeholder="המשוב שיוצג לתלמיד כשמצרפים הערה זו…"
              multiline
              minRows={4}
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              inputProps={{ dir: "rtl" }}
            />

            <TextField
              label="Teacher notes"
              placeholder="לעצמך: מתי להשתמש, טעויות נפוצות…"
              multiline
              minRows={7}
              fullWidth
              value={teacherText}
              onChange={(e) => setTeacherText(e.target.value)}
              inputProps={{ dir: "rtl" }}
              helperText="Optional, not shown to students. Helps you and the AI know when to use this comment."
            />

            <TextField
              label="Point deduction"
              type="number"
              value={points}
              onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            />

            {formError ? (
              <Alert severity="error" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="outlined" disabled={!canDelete || saving || deleting} onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving || deleting}
            onClick={() => void handleSave()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isNew || !selectedId ? "Create" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
      >
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Delete this comment?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Annotations that still reference it will show as “(deleted comment)”.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={() => void handleConfirmDelete()}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type EditTarget = null | { kind: "new" } | { kind: "edit"; comment: ProjectComment };

export default function CommentLibraryDialog({
  open,
  projectId,
  onClose,
  onLibraryUpdated,
}: Props) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setListError(null);
      setListLoading(true);
      try {
        const rows = await listProjectComments(projectId);
        if (!cancelled) setComments(rows);
      } catch (e) {
        if (!cancelled) setListError((e as Error).message || "Failed to load.");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setEditTarget(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => {
      const hay = `${c.key ?? ""} ${c.message} ${c.teacher_text}`.toLowerCase();
      return hay.includes(q);
    });
  }, [comments, search]);

  const handleEditSaved = (c: ProjectComment) => {
    setComments((prev) => {
      const exists = prev.some((x) => x.id === c.id);
      if (exists) return prev.map((x) => (x.id === c.id ? c : x));
      return [c, ...prev];
    });
    setEditTarget(null);
    onLibraryUpdated?.();
  };

  const handleEditDeleted = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setEditTarget(null);
    onLibraryUpdated?.();
  };

  const editOpen = editTarget !== null;
  const isNew = editTarget?.kind === "new";
  const editComment = editTarget?.kind === "edit" ? editTarget.comment : null;

  return (
    <>
      <Dialog
        open={open}
        onClose={(_, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown") onClose();
        }}
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          sx: {
            height: "min(88vh, 820px)",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <DialogTitle>Comment library</DialogTitle>
        <DialogContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            gap: 2,
            pt: 1,
          }}
        >
          {listError ? (
            <Alert severity="error" sx={{ flexShrink: 0 }} onClose={() => setListError(null)}>
              {listError}
            </Alert>
          ) : null}

          <TextField
            size="small"
            fullWidth
            placeholder="Search comments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexShrink: 0 }}
          />

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "auto",
              bgcolor: "action.hover",
            }}
          >
            {listLoading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
                <CircularProgress size={32} />
              </Stack>
            ) : filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {comments.length === 0
                  ? "No comments yet. Click “New comment” to write your first reusable line."
                  : "No matches. Try a different search."}
              </Typography>
            ) : (
              <Box
                dir="rtl"
                sx={{
                  direction: "rtl",
                  textAlign: "right",
                  minHeight: "100%",
                }}
              >
                <List dense disablePadding sx={{ width: "100%" }}>
                  {filtered.map((c) => (
                    <ListItemButton
                      key={c.id}
                      onClick={() => setEditTarget({ kind: "edit", comment: c })}
                      alignItems="flex-start"
                      sx={{
                        borderBottom: 1,
                        borderColor: "divider",
                        py: 1,
                        gap: 1,
                      }}
                    >
                      <ListItemText
                        primary={previewText(c.message)}
                        secondary={
                          c.teacher_text?.trim()
                            ? previewText(c.teacher_text, 100)
                            : undefined
                        }
                        primaryTypographyProps={{
                          variant: "body2",
                          sx: {
                            textAlign: "right",
                            whiteSpace: "normal",
                            unicodeBidi: "plaintext",
                          },
                        }}
                        secondaryTypographyProps={{
                          variant: "caption",
                          sx: {
                            textAlign: "right",
                            display: "block",
                            mt: 0.5,
                            unicodeBidi: "plaintext",
                          },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          flexShrink: 0,
                          alignSelf: "center",
                          color: (c.points ?? 0) > 0 ? "error.main" : "text.disabled",
                          fontWeight: 600,
                          minWidth: 44,
                          textAlign: "center",
                        }}
                      >
                        {(c.points ?? 0) > 0 ? `-${c.points}pt` : "0pt"}
                      </Typography>
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}
          </Box>

          <Stack direction="row" justifyContent="flex-end" sx={{ flexShrink: 0 }}>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditTarget({ kind: "new" })}>
              New comment
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <CommentEditDialog
        open={editOpen}
        projectId={projectId}
        isNew={isNew}
        comment={editComment}
        onClose={() => setEditTarget(null)}
        onSaved={handleEditSaved}
        onDeleted={handleEditDeleted}
      />
    </>
  );
}
