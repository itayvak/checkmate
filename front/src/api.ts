export type ProjectSummary = {
  id: string;
  created_at: string;
  name: string;
  assignment_name: string;
  model_solution_name: string;
};

export type CheckCase = {
  name?: string;
  passed?: boolean;
  output?: string;
  message?: string;
};

/** One inline comment attached to a source line (library id and/or free text). */
export type LineAnnotation = {
  line?: number;
  comment?: string;
  comment_id?: string;
};

export type WorkspaceStudent = {
  filename: string;
  code: string;
  check: {
    exit_code?: number | null;
    output?: string;
    passed?: number;
    total?: number;
    check_cases?: CheckCase[];
  } | null;
  annotation: {
    /** Normalized LLM improvement text; pass/fail lines are composed on the client. */
    ai_improvement: string;
    /** Set when auto-annotation failed; full message for the teacher. */
    annotation_error?: string;
    annotations?: LineAnnotation[];
  } | null;
};

export type ProjectComment = {
  id: string;
  project_id: string;
  key: string | null;
  /** Short label shown on every annotation of this type. */
  title: string;
  /** Longer explanation; UI may show this only on the first annotation per type per source. */
  details: string;
  teacher_text: string;
  points: number;
  /** Max total points that can be deducted for this comment_id for one student (repeated annotations cap). */
  max_points: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceDataResponse = {
  ok: boolean;
  project?: {
    name: string;
    assignment_name: string;
    model_solution_name: string;
    checker_script: string;
    comment_library: ProjectComment[];
  };
  students?: WorkspaceStudent[];
  error?: string;
};

export type UploadSourcesResponse =
  | { ok: true; count: number }
  | { ok: false; error: string };

export type DeleteSourceResponse =
  | {
      ok: true;
      deleted_filename: string;
      remaining_sources: number;
      removed_check_rows: number;
      removed_annotation_rows: number;
    }
  | { ok: false; error: string };

export type ProjectsListResponse = {
  ok: boolean;
  projects: ProjectSummary[];
};

export type CreateProjectResponse =
  | { ok: true; project_id: string; redirect_url: string }
  | { ok: false; errors: string[] };

export type DeleteProjectResponse =
  | { ok: true }
  | { ok: false; error: string };

export type RenameProjectResponse =
  | { ok: true; project_name: string }
  | { ok: false; error: string };

export type UpdateProjectFilesResponse =
  | { ok: true; assignment_name: string; model_solution_name: string }
  | { ok: false; error: string };

export type GenerateCheckerResponse =
  | { ok: true; checker_script: string }
  | { ok: false; errors?: string[]; error?: string };

export type CheckerPromptResponse =
  | { ok: true; prompt: string }
  | { ok: false; error: string };

export type RunCheckerResponse =
  | {
      ok: true;
      exit_code: number | null;
      output: string;
      check_cases?: Array<{ name?: string; passed?: boolean; output?: string; message?: string }>;
      passed?: number;
      total?: number;
    }
  | { ok: false; error: string };

export type SaveCheckerResponse =
  | { ok: true }
  | { ok: false; error: string };

export type RunCheckOnSourceResponse =
  | { ok: true; students: WorkspaceStudent[] }
  | { ok: false; error: string };

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects");
  const json = (await res.json()) as ProjectsListResponse;
  if (!res.ok || !json.ok) {
    throw new Error("Failed loading projects.");
  }
  return json.projects;
}

export async function createProject(params: {
  projectName: string;
  assignmentFile: File;
  modelSolutionFile: File;
}): Promise<CreateProjectResponse> {
  const fd = new FormData();
  fd.append("project_name", params.projectName);
  fd.append("assignment", params.assignmentFile);
  fd.append("model_solution", params.modelSolutionFile);

  const res = await fetch("/api/projects", { method: "POST", body: fd });
  const json = (await res.json()) as CreateProjectResponse;
  return json;
}

export async function deleteProject(projectId: string): Promise<DeleteProjectResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/delete`, {
    method: "POST",
  });
  const json = (await res.json()) as DeleteProjectResponse;
  return json;
}

export async function getWorkspaceData(projectId: string): Promise<WorkspaceDataResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/data`);
  const json = (await res.json()) as WorkspaceDataResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Failed loading project workspace.");
  }
  return json;
}

export async function uploadSources(
  projectId: string,
  files: File[],
): Promise<UploadSourcesResponse> {
  const fd = new FormData();
  for (const file of files) {
    fd.append("student_files", file);
  }

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sources/upload`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as UploadSourcesResponse;
  return json;
}

export async function deleteSource(
  projectId: string,
  filename: string,
): Promise<DeleteSourceResponse> {
  const fd = new FormData();
  fd.append("only_filename", filename);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sources/delete`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as DeleteSourceResponse;
  return json;
}

export async function renameProject(
  projectId: string,
  projectName: string,
): Promise<RenameProjectResponse> {
  const fd = new FormData();
  fd.append("project_name", projectName);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/rename`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as RenameProjectResponse;
  return json;
}

export async function updateProjectFiles(
  projectId: string,
  params: { assignmentFile?: File | null; modelFile?: File | null },
): Promise<UpdateProjectFilesResponse> {
  const fd = new FormData();
  if (params.assignmentFile) fd.append("assignment", params.assignmentFile, params.assignmentFile.name);
  if (params.modelFile) fd.append("model_solution", params.modelFile, params.modelFile.name);

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files/update`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as UpdateProjectFilesResponse;
  return json;
}

export async function generateCheckerScript(
  projectId: string,
  params: { apiKey: string; modelName: string; extraInstructions?: string },
): Promise<GenerateCheckerResponse> {
  const fd = new FormData();
  fd.append("api_key", params.apiKey);
  fd.append("model_name", params.modelName);
  fd.append("extra_instructions", params.extraInstructions || "");

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/checker/generate`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as GenerateCheckerResponse;
  return json;
}

export async function getCheckerGenerationPrompt(
  projectId: string,
  params: { extraInstructions?: string },
): Promise<CheckerPromptResponse> {
  const fd = new FormData();
  fd.append("extra_instructions", params.extraInstructions || "");

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/checker/prompt`, {
    method: "POST",
    body: fd,
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    await res.text();
    return {
      ok: false,
      error: `Unexpected non-JSON response (HTTP ${res.status}). Restart backend and retry.`,
    };
  }
  return (await res.json()) as CheckerPromptResponse;
}

export async function runCheckerScriptOnModel(
  projectId: string,
  checkerScript: string,
): Promise<RunCheckerResponse> {
  const fd = new FormData();
  fd.append("checker_script", checkerScript);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/checker/run`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as RunCheckerResponse;
  return json;
}

export async function saveCheckerScript(
  projectId: string,
  checkerScript: string,
): Promise<SaveCheckerResponse> {
  const fd = new FormData();
  fd.append("checker_script", checkerScript);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/checker/save`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as SaveCheckerResponse;
  return json;
}

/** Run the checker against a single uploaded source (same as legacy “Check run this source”). */
export async function runCheckOnSource(
  projectId: string,
  params: { checkerScript: string; filename: string },
): Promise<RunCheckOnSourceResponse> {
  const fd = new FormData();
  fd.append("checker_script", params.checkerScript);
  fd.append("only_filename", params.filename);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/run/check`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as RunCheckOnSourceResponse;
  return json;
}

export type RunAnnotateResponse =
  | { ok: true; students: WorkspaceStudent[]; comment_library?: ProjectComment[] }
  | { ok: false; error: string };

/** Gemini annotation for one source (`only_filename` matches the legacy template). */
export async function runAnnotate(
  projectId: string,
  params: {
    apiKey: string;
    modelName: string;
    filename: string;
    extraInstructions?: string;
  },
): Promise<RunAnnotateResponse> {
  const fd = new FormData();
  fd.append("api_key", params.apiKey);
  fd.append("model_name", params.modelName);
  fd.append("only_filename", params.filename);
  fd.append("extra_instructions", params.extraInstructions ?? "");
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/run/annotate`, {
    method: "POST",
    body: fd,
  });
  return (await res.json()) as RunAnnotateResponse;
}

export type ListCommentsResponse = { ok: true; comments: ProjectComment[] } | { ok: false; error: string };

export type CreateCommentResponse =
  | { ok: true; comment: ProjectComment }
  | { ok: false; error: string };

export type UpdateCommentResponse =
  | { ok: true; comment: ProjectComment }
  | { ok: false; error: string };

export type DeleteCommentResponse = { ok: true } | { ok: false; error: string };

export async function listProjectComments(projectId: string): Promise<ProjectComment[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments`);
  const json = (await res.json()) as ListCommentsResponse;
  if (!res.ok || !json.ok) {
    throw new Error(!json.ok && "error" in json ? json.error : "Failed to load comment library.");
  }
  return json.comments;
}

export async function createProjectComment(
  projectId: string,
  params: { title: string; details?: string; teacher_text?: string; points?: number; max_points?: number },
): Promise<CreateCommentResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: params.title,
      details: params.details ?? "",
      teacher_text: params.teacher_text ?? "",
      points: params.points ?? 0,
      max_points: params.max_points ?? 100,
    }),
  });
  return (await res.json()) as CreateCommentResponse;
}

export async function updateProjectComment(
  projectId: string,
  commentId: string,
  params: { title: string; details: string; teacher_text: string; points?: number; max_points?: number },
): Promise<UpdateCommentResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: params.title,
        details: params.details,
        teacher_text: params.teacher_text,
        points: params.points ?? 0,
        max_points: params.max_points ?? 100,
      }),
    },
  );
  return (await res.json()) as UpdateCommentResponse;
}

export async function deleteProjectComment(
  projectId: string,
  commentId: string,
): Promise<DeleteCommentResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}/delete`,
    { method: "POST" },
  );
  return (await res.json()) as DeleteCommentResponse;
}

/** Parsed row from a shared comment-library spreadsheet (matches export columns). */
export type CommentLibraryImportRow = {
  title: string;
  details: string;
  teacher_text: string;
  points: number;
  max_points: number;
  sheet_row?: number;
};

export type CommentLibraryImportPreviewResponse = {
  ok: true;
  rows: CommentLibraryImportRow[];
  skipped: { sheet_row: number; reason: string }[];
};

export async function previewCommentLibraryImport(
  projectId: string,
  file: File,
): Promise<CommentLibraryImportPreviewResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments/import/preview`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as
    | CommentLibraryImportPreviewResponse
    | { ok: false; error: string; skipped?: { sheet_row: number; reason: string }[] };
  if (!res.ok || !json.ok || !("rows" in json)) {
    throw new Error("error" in json && json.error ? json.error : "Preview failed.");
  }
  return json;
}

export type CommentLibraryImportCommitResult = {
  comments: ProjectComment[];
  errors?: { index: number; error: string }[] | null;
};

export async function commitCommentLibraryImport(
  projectId: string,
  rows: CommentLibraryImportRow[],
): Promise<CommentLibraryImportCommitResult> {
  const payload = rows.map(({ title, details, teacher_text, points, max_points }) => ({
    title,
    details,
    teacher_text,
    points,
    max_points,
  }));
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: payload }),
  });
  const json = (await res.json()) as { ok?: boolean; comments?: ProjectComment[]; errors?: { index: number; error: string }[] | null; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Import failed.");
  }
  return {
    comments: json.comments ?? [],
    errors: json.errors,
  };
}

/** Download the comment library as a standard .xlsx for sharing with other teachers. */
export async function downloadProjectCommentLibraryExport(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments/export`);
  if (!res.ok) {
    let message = "Export failed.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = "comment_library_comments.xlsx";
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(cd);
    const raw = m?.[1] ?? m?.[2];
    if (raw) {
      try {
        filename = decodeURIComponent(raw);
      } catch {
        filename = raw;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Replace or add a line annotation that references the comment library (`comment_id`). */
export type AddProjectAnnotationResponse =
  | { ok: true; annotation: { annotations?: LineAnnotation[]; ai_improvement?: string } }
  | { ok: false; error: string };

export async function addProjectAnnotation(
  projectId: string,
  params: { filename: string; line: number; commentId: string },
): Promise<AddProjectAnnotationResponse> {
  const fd = new FormData();
  fd.append("only_filename", params.filename);
  fd.append("line", String(params.line));
  fd.append("comment_id", params.commentId);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/annotations/add`, {
    method: "POST",
    body: fd,
  });
  return (await res.json()) as AddProjectAnnotationResponse;
}

export type DeleteProjectAnnotationResponse =
  | { ok: true; annotation: { annotations?: LineAnnotation[]; ai_improvement?: string } }
  | { ok: false; error: string };

export async function deleteProjectAnnotation(
  projectId: string,
  params: { filename: string; line: number },
): Promise<DeleteProjectAnnotationResponse> {
  const fd = new FormData();
  fd.append("only_filename", params.filename);
  fd.append("line", String(params.line));
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/annotations/delete`, {
    method: "POST",
    body: fd,
  });
  return (await res.json()) as DeleteProjectAnnotationResponse;
}

