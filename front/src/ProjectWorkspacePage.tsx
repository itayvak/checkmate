import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Box, IconButton, Snackbar, Stack, Typography } from "@mui/material";
import {
  deleteSource,
  generateCheckerScript,
  getWorkspaceData,
  renameProject,
  runCheckOnSource,
  runCheckerScriptOnModel,
  saveCheckerScript,
  updateProjectFiles,
  uploadSources,
  type RunCheckerResponse,
  type WorkspaceStudent,
} from "./api";
import WorkspaceTopBar from "./workspace/WorkspaceTopBar";
import WorkspaceSettingsMenu from "./workspace/WorkspaceSettingsMenu";
import ProjectSettingsDialog from "./workspace/ProjectSettingsDialog";
import AiSettingsDialog from "./workspace/AiSettingsDialog";
import SourcesSidebar from "./workspace/SourcesSidebar";
import SelectedSourceView from "./workspace/SelectedSourceView";
import CheckerScriptDialog from "./workspace/CheckerScriptDialog";
import CheckRunAllDialog, { type CheckRunAllProgress } from "./workspace/CheckRunAllDialog";
import DeleteSourceConfirmDialog from "./workspace/DeleteSourceConfirmDialog";
import { sortSourcesByFilename } from "./workspace/sortSources";
import {
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  SETTINGS_STORAGE_KEY,
} from "./workspace/constants";
import { CloseRounded } from "@mui/icons-material";

type Props = {
  projectId: string;
};

export default function ProjectWorkspacePage({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Project workspace");
  const [assignmentName, setAssignmentName] = useState("");
  const [modelSolutionName, setModelSolutionName] = useState("");
  const [students, setStudents] = useState<WorkspaceStudent[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [checkerDialogOpen, setCheckerDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelNameInput, setModelNameInput] = useState(DEFAULT_MODEL);
  const [checkerScript, setCheckerScript] = useState("");
  const [checkerContext, setCheckerContext] = useState("");
  const [checkerError, setCheckerError] = useState<string | null>(null);
  const [checkerRunResult, setCheckerRunResult] = useState<RunCheckerResponse | null>(null);
  const [checkerGenerating, setCheckerGenerating] = useState(false);
  const [checkerRunning, setCheckerRunning] = useState(false);
  const [checkerSaving, setCheckerSaving] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");
  const [settingsAssignmentFile, setSettingsAssignmentFile] = useState<File | null>(null);
  const [settingsModelFile, setSettingsModelFile] = useState<File | null>(null);
  const [projectSettingsError, setProjectSettingsError] = useState<string | null>(null);
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [checkThisSourcePending, setCheckThisSourcePending] = useState(false);
  const [deleteSourcePending, setDeleteSourcePending] = useState(false);
  const [deleteConfirmFilename, setDeleteConfirmFilename] = useState<string | null>(null);
  const [checkRunAllPending, setCheckRunAllPending] = useState(false);
  const [checkRunAllProgress, setCheckRunAllProgress] = useState<CheckRunAllProgress | null>(null);
  const checkRunAllCancelRequestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsMenuOpen = Boolean(settingsAnchorEl);

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setToast({ open: true, message, severity });
  };

  useEffect(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
      const apiKey = typeof parsed.api_key === "string" ? parsed.api_key : "";
      const modelName =
        typeof parsed.model_name === "string" && parsed.model_name
          ? parsed.model_name
          : DEFAULT_MODEL;
      setApiKeyInput(apiKey);
      setModelNameInput(modelName);
    } catch {
      setApiKeyInput("");
      setModelNameInput(DEFAULT_MODEL);
    }
  }, []);

  const refreshWorkspace = async (opts?: { preserveSelection?: boolean }) => {
    const preserveSelection = opts?.preserveSelection ?? true;
    const prevSelection = selectedFilename;
    const data = await getWorkspaceData(projectId);
    setProjectName(data.project?.name || "Project workspace");
    setAssignmentName(data.project?.assignment_name || "");
    setModelSolutionName(data.project?.model_solution_name || "");
    setCheckerScript(data.project?.checker_script || "");
    const rows = data.students || [];
    setStudents(rows);

    if (rows.length === 0) {
      setSelectedFilename(null);
      return rows;
    }

    if (preserveSelection && prevSelection && rows.some((s) => s.filename === prevSelection)) {
      setSelectedFilename(prevSelection);
    } else {
      setSelectedFilename(sortSourcesByFilename(rows)[0].filename);
    }
    return rows;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getWorkspaceData(projectId);
        if (cancelled) return;
        setProjectName(data.project?.name || "Project workspace");
        setAssignmentName(data.project?.assignment_name || "");
        setModelSolutionName(data.project?.model_solution_name || "");
        setCheckerScript(data.project?.checker_script || "");
        const rows = data.students || [];
        setStudents(rows);
        setSelectedFilename(
          rows.length > 0 ? sortSourcesByFilename(rows)[0].filename : null,
        );
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Failed loading workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.filename === selectedFilename) ?? null,
    [students, selectedFilename],
  );

  const studentsSorted = useMemo(
    () => sortSourcesByFilename(students),
    [students],
  );

  const onUploadFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const picked = Array.from(fileList);
    const pickedNames = new Set(picked.map((f) => f.name));
    setUploading(true);

    try {
      const result = await uploadSources(projectId, picked);
      if (!result.ok) {
        showToast(result.error || "Failed uploading source files.", "error");
        return;
      }

      const rows = await refreshWorkspace({ preserveSelection: true });
      const uploadedInRows = sortSourcesByFilename(
        rows.filter((r) => pickedNames.has(r.filename)),
      );
      if (uploadedInRows.length > 0) {
        setSelectedFilename(uploadedInRows[0].filename);
      }
      showToast(
        `${result.count} source file${result.count === 1 ? "" : "s"} uploaded successfully.`,
      );
    } catch (err) {
      showToast((err as Error).message || "Failed uploading source files.", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const openAiSettings = () => {
    setSettingsAnchorEl(null);
    setAiSettingsOpen(true);
  };

  const openProjectSettings = () => {
    setSettingsAnchorEl(null);
    setProjectNameInput(projectName || "");
    setSettingsAssignmentFile(null);
    setSettingsModelFile(null);
    setProjectSettingsError(null);
    setProjectSettingsOpen(true);
  };

  const openCheckerDialog = () => {
    setSettingsAnchorEl(null);
    setCheckerError(null);
    setCheckerRunResult(null);
    setCheckerDialogOpen(true);
  };

  const closeAiSettings = () => {
    setAiSettingsOpen(false);
  };

  const closeProjectSettings = () => {
    setProjectSettingsOpen(false);
    setProjectSettingsError(null);
    setSavingProjectSettings(false);
  };

  const closeCheckerDialog = () => {
    setCheckerDialogOpen(false);
    setCheckerError(null);
  };

  const saveAiSettings = () => {
    const payload = {
      api_key: apiKeyInput.trim(),
      model_name: modelNameInput,
    };
    sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    setAiSettingsOpen(false);
    showToast(
      payload.api_key ? "Gemini settings saved." : "Gemini settings saved. API key NOT set.",
    );
  };

  const saveProjectSettings = async () => {
    if (savingProjectSettings) return;

    setProjectSettingsError(null);
    const requestedProjectName = projectNameInput.trim();
    if (!requestedProjectName) {
      setProjectSettingsError("Project name is required.");
      return;
    }

    const shouldRename = requestedProjectName !== (projectName || "");
    const shouldUpdateFiles = Boolean(settingsAssignmentFile || settingsModelFile);

    try {
      setSavingProjectSettings(true);

      if (shouldRename) {
        const renameJson = await renameProject(projectId, requestedProjectName);
        if (!renameJson.ok) {
          setProjectSettingsError(renameJson.error || "Failed renaming project.");
          setSavingProjectSettings(false);
          return;
        }
        setProjectName(renameJson.project_name || requestedProjectName);
      }

      if (shouldUpdateFiles) {
        const filesJson = await updateProjectFiles(projectId, {
          assignmentFile: settingsAssignmentFile,
          modelFile: settingsModelFile,
        });
        if (!filesJson.ok) {
          setProjectSettingsError(filesJson.error || "Failed updating project files.");
          setSavingProjectSettings(false);
          return;
        }
        setAssignmentName(filesJson.assignment_name || assignmentName || "");
        setModelSolutionName(filesJson.model_solution_name || modelSolutionName || "");
      }

      await refreshWorkspace({ preserveSelection: true });
      closeProjectSettings();

      if (shouldRename && shouldUpdateFiles) {
        showToast("Settings saved. Project renamed and files updated.");
      } else if (shouldRename) {
        showToast("Settings saved. Project renamed.");
      } else if (shouldUpdateFiles) {
        showToast("Settings saved. Project files updated.");
      } else {
        showToast("Settings saved.");
      }
    } catch (e) {
      setProjectSettingsError((e as Error).message || "Failed saving settings.");
      setSavingProjectSettings(false);
    }
  };

  const runCheckerFromDialog = async () => {
    const script = checkerScript || "";
    if (!script.trim()) {
      setCheckerError("Write or generate a checker script first.");
      return false;
    }

    setCheckerError(null);
    setCheckerRunning(true);
    try {
      const result = await runCheckerScriptOnModel(projectId, script);
      setCheckerRunResult(result);
      if (!result.ok) {
        setCheckerError(result.error || "Run failed.");
        return false;
      }
      return true;
    } catch (e) {
      setCheckerError((e as Error).message || "Run failed.");
      return false;
    } finally {
      setCheckerRunning(false);
    }
  };

  const generateCheckerFromDialog = async () => {
    setCheckerError(null);
    if (!apiKeyInput.trim()) {
      setCheckerError("Open AI settings and enter an API key first.");
      return;
    }

    setCheckerGenerating(true);
    try {
      const result = await generateCheckerScript(projectId, {
        apiKey: apiKeyInput.trim(),
        modelName: modelNameInput,
        extraInstructions: checkerContext.trim(),
      });
      if (!result.ok) {
        const msg = result.errors?.[0] || result.error || "Checker generation failed.";
        setCheckerError(msg);
        return;
      }

      setCheckerScript(result.checker_script || "");
      showToast("Checker script generated.");
      await runCheckerFromDialog();
    } catch (e) {
      setCheckerError((e as Error).message || "Checker generation failed.");
    } finally {
      setCheckerGenerating(false);
    }
  };

  const workspaceCheckBusy =
    checkThisSourcePending ||
    checkRunAllPending ||
    deleteSourcePending ||
    Boolean(deleteConfirmFilename);

  const runCheckAll = async () => {
    const script = checkerScript.trim();
    if (!script) {
      showToast('No checker script. Open "Checker script" in Settings to add one.', "error");
      return;
    }
    if (students.length === 0) {
      showToast("No sources uploaded yet.", "error");
      return;
    }
    if (
      checkRunAllPending ||
      checkThisSourcePending ||
      deleteSourcePending ||
      deleteConfirmFilename
    ) {
      return;
    }

    const queue = studentsSorted.slice();
    const total = queue.length;
    let errors = 0;
    checkRunAllCancelRequestedRef.current = false;

    setCheckRunAllPending(true);
    setCheckRunAllProgress({
      total,
      doneCount: 0,
      currentFilename: queue[0]?.filename ?? "",
    });

    try {
      let completed = 0;

      for (let i = 0; i < total; i++) {
        if (checkRunAllCancelRequestedRef.current) break;

        const student = queue[i];
        setCheckRunAllProgress({
          total,
          doneCount: i,
          currentFilename: student.filename,
        });

        try {
          const result = await runCheckOnSource(projectId, {
            checkerScript: script,
            filename: student.filename,
          });
          if (!result.ok) {
            errors++;
          } else {
            setStudents((prev) => {
              const updates = new Map(result.students.map((s) => [s.filename, s]));
              return prev.map((s) => updates.get(s.filename) ?? s);
            });
          }
        } catch {
          errors++;
        }

        completed++;
        setCheckRunAllProgress({
          total,
          doneCount: completed,
          currentFilename: student.filename,
        });

        if (checkRunAllCancelRequestedRef.current) break;
      }

      if (checkRunAllCancelRequestedRef.current) {
        showToast(`Check run all cancelled (${completed} of ${total} sources completed).`);
      } else {
        showToast(
          errors
            ? `Check run all done — ${errors} error(s).`
            : `Check run all complete (${total} sources).`,
          errors ? "error" : "success",
        );
      }
    } finally {
      setCheckRunAllPending(false);
      setCheckRunAllProgress(null);
    }
  };

  const requestCheckRunAllCancel = () => {
    checkRunAllCancelRequestedRef.current = true;
  };

  const runCheckThisSource = async () => {
    if (
      !selectedStudent ||
      checkThisSourcePending ||
      checkRunAllPending ||
      deleteSourcePending ||
      deleteConfirmFilename
    ) {
      return;
    }
    const script = checkerScript.trim();
    if (!script) {
      showToast('No checker script — open "Checker script" in Settings to add one.', "error");
      return;
    }

    setCheckThisSourcePending(true);
    try {
      const result = await runCheckOnSource(projectId, {
        checkerScript: script,
        filename: selectedStudent.filename,
      });
      if (!result.ok) {
        showToast(result.error || "Check run failed.", "error");
        return;
      }
      setStudents((prev) => {
        const updates = new Map(result.students.map((s) => [s.filename, s]));
        return prev.map((s) => updates.get(s.filename) ?? s);
      });
      showToast(`Check run complete for ${selectedStudent.filename}.`);
    } catch (e) {
      showToast((e as Error).message || "Check run failed.", "error");
    } finally {
      setCheckThisSourcePending(false);
    }
  };

  const openDeleteSourceConfirm = () => {
    if (!selectedStudent || deleteSourcePending || checkRunAllPending || checkThisSourcePending) {
      return;
    }
    setDeleteConfirmFilename(selectedStudent.filename);
  };

  const cancelDeleteSourceConfirm = () => {
    if (deleteSourcePending) return;
    setDeleteConfirmFilename(null);
  };

  const confirmDeleteSource = async () => {
    const filename = deleteConfirmFilename;
    if (!filename || deleteSourcePending) return;

    setDeleteSourcePending(true);
    try {
      const result = await deleteSource(projectId, filename);
      if (!result.ok) {
        showToast(result.error || "Delete failed.", "error");
        return;
      }
      setDeleteConfirmFilename(null);
      await refreshWorkspace({ preserveSelection: true });
      showToast(`Deleted ${filename}.`);
    } catch (e) {
      showToast((e as Error).message || "Delete failed.", "error");
    } finally {
      setDeleteSourcePending(false);
    }
  };

  const saveCheckerFromDialog = async () => {
    setCheckerError(null);
    const script = checkerScript || "";
    if (!script.trim()) {
      setCheckerError("Checker script is empty.");
      return;
    }
    setCheckerSaving(true);
    try {
      const result = await saveCheckerScript(projectId, script);
      if (!result.ok) {
        setCheckerError(result.error || "Save failed.");
        return;
      }
      showToast("Checker script saved.");
      setCheckerDialogOpen(false);
    } catch (e) {
      setCheckerError((e as Error).message || "Save failed.");
    } finally {
      setCheckerSaving(false);
    }
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <WorkspaceTopBar
        projectName={projectName}
        onOpenSettings={(anchorEl) => setSettingsAnchorEl(anchorEl)}
        onCheckRunAll={runCheckAll}
        checkRunAllDisabled={
          !checkerScript.trim() ||
          students.length === 0 ||
          checkRunAllPending ||
          checkThisSourcePending ||
          deleteSourcePending ||
          Boolean(deleteConfirmFilename)
        }
        checkRunAllPending={checkRunAllPending}
      />

      <CheckRunAllDialog
        open={checkRunAllPending}
        progress={checkRunAllProgress}
        onCancel={requestCheckRunAllCancel}
      />
      <DeleteSourceConfirmDialog
        open={deleteConfirmFilename !== null}
        filename={deleteConfirmFilename ?? ""}
        loading={deleteSourcePending}
        onCancel={cancelDeleteSourceConfirm}
        onConfirm={confirmDeleteSource}
      />
      <WorkspaceSettingsMenu
        anchorEl={settingsAnchorEl}
        open={settingsMenuOpen}
        onClose={() => setSettingsAnchorEl(null)}
        onProjectSettings={openProjectSettings}
        onAiSettings={openAiSettings}
        onCheckerScript={() => {
          openCheckerDialog();
        }}
        onCommentLibrary={() => {
          setSettingsAnchorEl(null);
          showToast("Rename project flow will be added next.");
        }}
      />
      <ProjectSettingsDialog
        open={projectSettingsOpen}
        projectNameInput={projectNameInput}
        assignmentName={assignmentName}
        modelSolutionName={modelSolutionName}
        assignmentFile={settingsAssignmentFile}
        modelFile={settingsModelFile}
        error={projectSettingsError}
        saving={savingProjectSettings}
        onClose={closeProjectSettings}
        onSave={saveProjectSettings}
        onProjectNameChange={setProjectNameInput}
        onAssignmentFileChange={setSettingsAssignmentFile}
        onModelFileChange={setSettingsModelFile}
      />
      <AiSettingsDialog
        open={aiSettingsOpen}
        apiKey={apiKeyInput}
        modelName={modelNameInput}
        modelOptions={MODEL_OPTIONS}
        onClose={closeAiSettings}
        onSave={saveAiSettings}
        onApiKeyChange={setApiKeyInput}
        onModelNameChange={setModelNameInput}
      />
      <CheckerScriptDialog
        open={checkerDialogOpen}
        checkerScript={checkerScript}
        checkerContext={checkerContext}
        checkerError={checkerError}
        runResult={checkerRunResult}
        generating={checkerGenerating}
        running={checkerRunning}
        saving={checkerSaving}
        onClose={closeCheckerDialog}
        onCheckerScriptChange={setCheckerScript}
        onCheckerContextChange={setCheckerContext}
        onGenerate={generateCheckerFromDialog}
        onRun={runCheckerFromDialog}
        onSave={saveCheckerFromDialog}
      />

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SourcesSidebar
          students={studentsSorted}
          selectedFilename={selectedFilename}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onSelectFilename={setSelectedFilename}
          onUploadFilesSelected={onUploadFilesSelected}
        />

        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, p: 0, overflow: "auto" }}>
          {loading ? (
            <Typography color="text.secondary">Loading workspace...</Typography>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : !selectedStudent ? (
            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: "60vh" }}>
              <Typography variant="h6" color="text.secondary">
                {students.length === 0 ? "Upload source files to get started" : "Select a source from the sidebar"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {students.length === 0
                  ? 'Use the "Upload source files" button below the list.'
                  : "Click any name to view its code and results."}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Assignment: {assignmentName || "(none)"} | Model: {modelSolutionName || "(none)"}
              </Typography>
            </Stack>
          ) : (
            <SelectedSourceView
              student={selectedStudent}
              checkerScriptPresent={Boolean(checkerScript.trim())}
              workspaceBusy={workspaceCheckBusy}
              checkThisSourceRunning={checkThisSourcePending}
              deletePending={deleteSourcePending}
              onCheckRunThisSource={runCheckThisSource}
              onDeleteSource={openDeleteSourceConfirm}
            />
          )}
        </Box>
      </Box>
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={toast.message}
        slotProps={{
          content: {
            sx: {
              minWidth: { xs: "min(100% - 32px, 520px)", sm: 560 },
              maxWidth: "min(92vw, 640px)",
            },
          },
        }}
        action={(
          <IconButton color="inherit" size="small" onClick={() => setToast((prev) => ({ ...prev, open: false }))}><CloseRounded fontSize="small" /></IconButton>
        )}
      />
    </Box>
  );
}

