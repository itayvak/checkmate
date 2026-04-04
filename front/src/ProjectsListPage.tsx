import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  DialogContentText,
  Stack,
  TextField,
  Typography,
  CardHeader,
  CardActions,
  CardActionArea,
} from "@mui/material";
import { createProject, deleteProject, listProjects, type ProjectSummary } from "./api";
import FileSelectButton from "./FileSelectButton";
import ThemeModeToggle from "./ThemeModeToggle.tsx";

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [modelSolutionFile, setModelSolutionFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteVerifyName, setDeleteVerifyName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listProjects();
        if (!cancelled) setProjects(rows);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message ?? "Failed to load projects.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasNoProjects = useMemo(() => projects && projects.length === 0, [projects]);
  const deleteTargetProjectName = useMemo(() => {
    if (!projects || !deleteTargetId) return "";
    return projects.find((p) => p.id === deleteTargetId)?.name ?? "";
  }, [projects, deleteTargetId]);
  const deleteVerificationMatches = deleteVerifyName === deleteTargetProjectName;

  const resetNewProjectForm = () => {
    setProjectName("");
    setAssignmentFile(null);
    setModelSolutionFile(null);
    setCreateError(null);
    setSubmitting(false);
  };

  const closeNewProject = () => {
    setNewProjectOpen(false);
    resetNewProjectForm();
  };

  const onCreate = async () => {
    if (submitting) return;

    setCreateError(null);

    const name = projectName.trim();
    if (!name) {
      setCreateError("Project name is required.");
      return;
    }
    if (!assignmentFile) {
      setCreateError("Please upload the assignment Markdown file.");
      return;
    }
    if (!modelSolutionFile) {
      setCreateError("Please upload the model solution Python file.");
      return;
    }

    try {
      setSubmitting(true);
      const json = await createProject({
        projectName: name,
        assignmentFile,
        modelSolutionFile,
      });

      if (!json.ok) {
        setCreateError(json.errors?.[0] ?? "Failed creating project.");
        setSubmitting(false);
        return;
      }

      // Backend returns a Flask route (`/projects/<id>`). Full page load
      // is used because workspace UI is still server-rendered.
      window.location.href = json.redirect_url;
    } catch (e) {
      setCreateError((e as Error).message ?? "Failed creating project.");
      setSubmitting(false);
    }
  };

  const openDelete = (projectId: string) => {
    setDeleteTargetId(projectId);
    setDeleteVerifyName("");
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const closeDelete = () => {
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
    setDeleteVerifyName("");
    setDeleteError(null);
    setDeleting(false);
  };

  const onConfirmDelete = async () => {
    if (!deleteTargetId || deleting || !deleteVerificationMatches) return;

    setDeleteError(null);
    setDeleting(true);

    try {
      const json = await deleteProject(deleteTargetId);
      if (!json.ok) {
        setDeleteError(json.error || "Failed deleting project.");
        setDeleting(false);
        return;
      }

      setProjects((prev) => (prev ? prev.filter((p) => p.id !== deleteTargetId) : prev));
      closeDelete();
    } catch (e) {
      setDeleteError((e as Error).message ?? "Failed deleting project.");
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", px: 2, py: 4 }}>
      <Stack spacing={2} sx={{ maxWidth: 860, mx: "auto" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          flexWrap="wrap"
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              component="img"
              src="/appLogo.png"
              alt=""
              sx={{ height: 48, width: "auto", display: "block", objectFit: "contain" }}
            />
            <Box>
              <Typography variant="h4">Check Mate</Typography>
              <Typography variant="body2" color="text.secondary">
                Your projects
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <ThemeModeToggle />
            <Button variant="contained" onClick={() => setNewProjectOpen(true)}>
              New project
            </Button>
          </Stack>
        </Stack>

        {loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : projects === null ? (
          <Typography color="text.secondary">Loading...</Typography>
        ) : hasNoProjects ? (
          <Stack spacing={1} alignItems="center" sx={{ py: 10 }}>
            <Typography variant="h6" sx={{ color: "text.primary" }}>
              No projects yet
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Create your first project to start grading.
            </Typography>
            <Button
              variant="contained"
              onClick={() => setNewProjectOpen(true)}
              sx={{ mt: 1 }}
            >
              Create first project
            </Button>
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 2,
            }}
          >
            {projects.map((p) => (
              <Card
                key={p.id}
                variant="elevation"
                sx={{ height: "fit-content", display: "flex", flexDirection: "column" }}
              >
                <CardActionArea
                  onClick={() => {
                    window.location.href = `/projects/${p.id}`;
                  }}
                  disabled={submitting}
                >
                  <CardHeader
                    title={p.name}
                  />
                  <CardContent sx={{ flex: 1, flexGrow: 1 }}>
                    <Stack spacing={1}>
                      <Stack spacing={0.25}>
                        <Typography variant="caption" color="text.secondary">
                          Assignment file
                        </Typography>
                        <Typography variant="body2">{p.assignment_name}</Typography>
                      </Stack>
                      <Stack spacing={0.25}>
                        <Typography variant="caption" color="text.secondary">
                          Solution file
                        </Typography>
                        <Typography variant="body2">{p.model_solution_name}</Typography>
                      </Stack>
                      <Stack spacing={0.25}>
                        <Typography variant="caption" color="text.secondary">
                          Created at
                        </Typography>
                        <Typography variant="body2">{p.created_at || "unknown"}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={deleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDelete(p.id);
                      }}
                    >
                      Delete
                    </Button>
                    <Button variant="contained">
                      Open project
                    </Button>
                  </CardActions>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </Stack>

      <Dialog
        open={newProjectOpen}
        onClose={closeNewProject}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New project</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Create a new grading project by uploading the assignment and model solution.
          </DialogContentText>

          <Stack spacing={2} sx={{ mt: 1 }}>
            {createError ? <Alert severity="error">{createError}</Alert> : null}

            <TextField
              label="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />

            <FileSelectButton
              placeholder="Assignment file"
              accept=".md,.txt"
              file={assignmentFile}
              onFileChange={setAssignmentFile}
              fullWidth
              disabled={submitting}
            />

            <FileSelectButton
              placeholder="Model solution"
              accept=".py"
              file={modelSolutionFile}
              onFileChange={setModelSolutionFile}
              fullWidth
              disabled={submitting}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeNewProject} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={onCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create project"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={closeDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete project?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove the project (and its stored sources/comments).
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            sx={{ mt: 2 }}
            label="Project name confirmation"
            value={deleteVerifyName}
            onChange={(e) => setDeleteVerifyName(e.target.value)}
            placeholder={deleteTargetProjectName}
            disabled={deleting}
            error={deleteVerifyName.length > 0 && !deleteVerificationMatches}
            helperText={
              deleteVerifyName.length === 0 || deleteVerificationMatches
                ? ""
                : "Project name does not match."
            }
          />
          {deleteError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={onConfirmDelete}
            disabled={deleting || !deleteVerificationMatches}
          >
            {deleting ? "Deleting..." : "Delete project"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

