import { useEffect, useMemo, useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadRounded from "@mui/icons-material/UploadRounded";
import {
  commitCommentLibraryImport,
  createProjectComment,
  deleteProjectComment,
  downloadProjectCommentLibraryExport,
  listProjectComments,
  previewCommentLibraryImport,
  updateProjectComment,
  type CommentLibraryImportRow,
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
  if (!t) return "(empty)";
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
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [teacherText, setTeacherText] = useState("");
  const [points, setPoints] = useState(0);
  const [maxPoints, setMaxPoints] = useState(100);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedId = comment?.id ?? null;
  const canDelete = Boolean(selectedId) && !isNew;

  useEffect(() => {
    if (!open) return;
    if (isNew || !comment) {
      setTitle("");
      setDetails("");
      setTeacherText("");
      setPoints(0);
      setMaxPoints(100);
    } else {
      setTitle(comment.title || "");
      setDetails(comment.details || "");
      setTeacherText(comment.teacher_text || "");
      setPoints(comment.points ?? 0);
      setMaxPoints(comment.max_points ?? 100);
    }
    setFormError(null);
    setDeleteOpen(false);
  }, [open, isNew, comment]);

  const handleSave = async () => {
    const t = title.trim();
    if (!t) {
      setFormError("Title is required.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const pts = Math.max(0, Math.round(points || 0));
      const cap = Math.max(0, Math.round(maxPoints || 0));
      const det = details.trim();
      if (isNew || !selectedId) {
        const json = await createProjectComment(projectId, {
          title: t,
          details: det,
          teacher_text: teacherText.trim(),
          points: pts,
          max_points: cap,
        });
        if (!json.ok) {
          setFormError(json.error || "Could not create comment.");
          return;
        }
        onSaved(json.comment);
      } else {
        const json = await updateProjectComment(projectId, selectedId, {
          title: t,
          details: det,
          teacher_text: teacherText.trim(),
          points: pts,
          max_points: cap,
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
              label="Title"
              placeholder="תיאור קצר (מוצג בכל שורה שבה מופיעה הערה זו)…"
              multiline
              minRows={2}
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ dir: "rtl" }}
            />

            <TextField
              label="Details"
              placeholder="הסבר מורחב יותר (מוצג לתלמיד פעם אחת לכל סוג הערה בקוד)…"
              multiline
              minRows={4}
              fullWidth
              value={details}
              onChange={(e) => setDetails(e.target.value)}
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

            <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
              <TextField
                fullWidth
                label="Point deduction"
                type="number"
                value={points}
                onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              />
              <TextField
                fullWidth
                label="Max point deduction per student"
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                slotProps={{ htmlInput: { min: 0, max: 10000, step: 1 } }}
              />
            </Stack>

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

type ImportPreviewState = {
  rows: CommentLibraryImportRow[];
  skipped: { sheet_row: number; reason: string }[];
};

function CommentImportConfirmDialog({
  open,
  rows,
  skipped,
  committing,
  onClose,
  onConfirm,
}: {
  open: boolean;
  rows: CommentLibraryImportRow[];
  skipped: { sheet_row: number; reason: string }[];
  committing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (committing) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") onClose();
      }}
      fullWidth
      maxWidth="lg"
      scroll="paper"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
    >
      <DialogTitle>Import comments</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            The following {rows.length} comment{rows.length === 1 ? "" : "s"} will be added to this project&apos;s
            library. Existing comments are not changed.
          </Typography>
          {skipped.length > 0 ? (
            <Alert severity="info">
              {skipped.length} spreadsheet row{skipped.length === 1 ? "" : "s"} skipped (e.g. empty title).
            </Alert>
          ) : null}
          <TableContainer
            sx={{
              maxHeight: "min(52vh, 420px)",
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Teacher text</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    Points
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    Max
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.sheet_row ?? i}-${i}`}>
                    <TableCell
                      sx={{
                        verticalAlign: "top",
                        maxWidth: 200,
                        direction: "rtl",
                        textAlign: "right",
                        unicodeBidi: "plaintext",
                      }}
                    >
                      {previewText(r.title, 400)}
                    </TableCell>
                    <TableCell
                      sx={{
                        verticalAlign: "top",
                        maxWidth: 220,
                        direction: "rtl",
                        textAlign: "right",
                        unicodeBidi: "plaintext",
                      }}
                    >
                      {r.teacher_text?.trim() ? previewText(r.teacher_text, 400) : "—"}
                    </TableCell>
                    <TableCell
                      sx={{
                        verticalAlign: "top",
                        maxWidth: 220,
                        direction: "rtl",
                        textAlign: "right",
                        unicodeBidi: "plaintext",
                      }}
                    >
                      {r.details?.trim() ? previewText(r.details, 400) : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {r.points}
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {r.max_points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={committing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void onConfirm()}
          disabled={committing}
          startIcon={committing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Import {rows.length} comment{rows.length === 1 ? "" : "s"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [exporting, setExporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importCommitting, setImportCommitting] = useState(false);

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
      setImportPreview(null);
      setImportParsing(false);
      setImportCommitting(false);
    }
  }, [open]);

  const handleImportFileChosen = (file: File) => {
    void (async () => {
      setListError(null);
      setImportParsing(true);
      try {
        const result = await previewCommentLibraryImport(projectId, file);
        setImportPreview({ rows: result.rows, skipped: result.skipped });
      } catch (e) {
        setListError((e as Error).message || "Could not read file.");
      } finally {
        setImportParsing(false);
      }
    })();
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    void (async () => {
      setImportCommitting(true);
      setListError(null);
      try {
        const result = await commitCommentLibraryImport(projectId, importPreview.rows);
        const added = result.comments ?? [];
        setComments((prev) => [...added, ...prev]);
        setImportPreview(null);
        onLibraryUpdated?.();
        if (result.errors?.length) {
          setListError(
            `Imported ${added.length} comment${added.length === 1 ? "" : "s"}. ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} could not be saved.`,
          );
        }
      } catch (e) {
        setListError((e as Error).message || "Import failed.");
      } finally {
        setImportCommitting(false);
      }
    })();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => {
      const hay = `${c.key ?? ""} ${c.title} ${c.details} ${c.teacher_text}`.toLowerCase();
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
                        primary={previewText(c.title)}
                        secondary={
                          c.details?.trim() || c.teacher_text?.trim() ? (
                            <>
                              {c.details?.trim() ? (
                                <Typography
                                  variant="caption"
                                  component="span"
                                  sx={{
                                    textAlign: "right",
                                    display: "block",
                                    unicodeBidi: "plaintext",
                                  }}
                                >
                                  {previewText(c.details, 120)}
                                </Typography>
                              ) : null}
                              {c.teacher_text?.trim() ? (
                                <Typography
                                  variant="caption"
                                  component="span"
                                  color="text.secondary"
                                  sx={{
                                    textAlign: "right",
                                    display: "block",
                                    mt: c.details?.trim() ? 0.5 : 0,
                                    unicodeBidi: "plaintext",
                                  }}
                                >
                                  {previewText(c.teacher_text, 100)}
                                </Typography>
                              ) : null}
                            </>
                          ) : undefined
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
                          component: "div",
                          variant: "caption",
                          sx: {
                            textAlign: "right",
                            display: "block",
                            mt: 0.5,
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
                          minWidth: 72,
                          textAlign: "center",
                        }}
                      >
                        {(c.points ?? 0) > 0 ? `${c.points}pt` : "0pt"}
                        <Box component="span" sx={{ display: "block", fontWeight: 400, color: "text.secondary" }}>
                          max {c.max_points ?? 100}pt
                        </Box>
                      </Typography>
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}
          </Box>

          <Stack direction="row" justifyContent="flex-end" flexWrap="wrap" gap={1} sx={{ flexShrink: 0 }}>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleImportFileChosen(f);
              }}
            />
            <Button
              variant="outlined"
              startIcon={importParsing ? <CircularProgress size={16} /> : <UploadRounded />}
              disabled={listLoading || importParsing || exporting}
              onClick={() => importFileInputRef.current?.click()}
            >
              Import from Weboneh Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadRounded />}
              disabled={listLoading || exporting}
              onClick={() => {
                void (async () => {
                  setExporting(true);
                  try {
                    await downloadProjectCommentLibraryExport(projectId);
                  } catch (e) {
                    setListError((e as Error).message || "Export failed.");
                  } finally {
                    setExporting(false);
                  }
                })();
              }}
            >
              Export to Weboneh Excel
            </Button>
            <Box sx={{ flex: 1 }} />
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

      <CommentImportConfirmDialog
        open={importPreview !== null}
        rows={importPreview?.rows ?? []}
        skipped={importPreview?.skipped ?? []}
        committing={importCommitting}
        onClose={() => !importCommitting && setImportPreview(null)}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
