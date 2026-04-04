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
    summary?: string;
    annotations?: LineAnnotation[];
  } | null;
};

export type ProjectComment = {
  id: string;
  project_id: string;
  key: string | null;
  message: string;
  teacher_text: string;
  points: number;
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
  params: { message: string; teacher_text?: string; points?: number },
): Promise<CreateCommentResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: params.message,
      teacher_text: params.teacher_text ?? "",
      points: params.points ?? 0,
    }),
  });
  return (await res.json()) as CreateCommentResponse;
}

export async function updateProjectComment(
  projectId: string,
  commentId: string,
  params: { message: string; teacher_text: string; points?: number },
): Promise<UpdateCommentResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        teacher_text: params.teacher_text,
        points: params.points ?? 0,
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

