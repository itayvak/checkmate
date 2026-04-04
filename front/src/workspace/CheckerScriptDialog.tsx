import { useEffect, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import Editor from "@monaco-editor/react";
import type { RunCheckerResponse } from "../api";
import CheckRunResults from "./CheckRunResults";
import { borderRadius, useAppColors } from "../MuiTheme.tsx";

type Props = {
  open: boolean;
  checkerScript: string;
  checkerContext: string;
  checkerError: string | null;
  runResult: RunCheckerResponse | null;
  generating: boolean;
  copyingPrompt: boolean;
  running: boolean;
  saving: boolean;
  onClose: () => void;
  onCheckerScriptChange: (value: string) => void;
  onCheckerContextChange: (value: string) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onRun: () => void;
  onSave: () => void;
};

export default function CheckerScriptDialog(props: Props) {
  const colors = useAppColors();
  const [editorValue, setEditorValue] = useState(props.checkerScript);
  const hasUnsavedChanges = editorValue !== props.checkerScript;
  const monacoThemeName =
    colors.mode === "dark" ? "checkmate-code-dark" : "checkmate-code-light";

  useEffect(() => {
    if (props.open) {
      setEditorValue(props.checkerScript);
    }
  }, [props.checkerScript, props.open]);

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Checker script</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The checker script is used to check a student's solution at runtime. It will output a JSON object describing the results of the check.
          <br />
          You may also copy the generation prompt to generate a checker yourself.
        </DialogContentText>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Box sx={{ borderRadius: borderRadius.small+"px", overflow: "hidden" }}>
            <Editor
              height="380px"
              defaultLanguage="python"
              language="python"
              beforeMount={(monaco) => {
                monaco.editor.defineTheme("checkmate-code-dark", {
                  base: "vs-dark",
                  inherit: true,
                  rules: [],
                  colors: {
                    "editor.background": colors.surfaceContainerLow,
                  },
                });
                monaco.editor.defineTheme("checkmate-code-light", {
                  base: "vs",
                  inherit: true,
                  rules: [],
                  colors: {
                    "editor.background": colors.surfaceContainerLow,
                  },
                });
              }}
              key={monacoThemeName}
              theme={monacoThemeName}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              value={editorValue}
              onChange={(value) => setEditorValue(value ?? "")}
            />
          </Box>
          {hasUnsavedChanges ? (
            <Typography variant="caption" color="error.main">
              Unsaved changes
            </Typography>
          ) : null}
          <TextField
            multiline
            minRows={3}
            maxRows={8}
            value={props.checkerContext}
            onChange={(e: ChangeEvent<HTMLInputElement>) => props.onCheckerContextChange(e.target.value)}
            placeholder="Additional context for AI generation (optional)"
            fullWidth
          />

          {props.checkerError ? <Alert severity="error">{props.checkerError}</Alert> : null}

          {props.runResult ? (
            <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5 }}>
              {props.runResult.ok ? (
                <Typography variant="caption">
                  Model solution result ({props.runResult.passed ?? 0} /{" "}
                  {props.runResult.total ?? props.runResult.check_cases?.length ?? 0} passed)
                </Typography>
              ) : null}
              <Box sx={{ mt: 1 }}>
                <CheckRunResults result={props.runResult} />
              </Box>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          startIcon={props.generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeRoundedIcon />}
          onClick={() => {
            props.onCheckerScriptChange(editorValue);
            props.onGenerate();
          }}
          disabled={props.generating || props.running || props.saving}
        >
          {props.generating ? "Generating..." : "Generate with AI"}
        </Button>
        <Button
          variant="outlined"
          startIcon={<ContentCopyRoundedIcon />}
          onClick={props.onCopyPrompt}
          disabled={props.generating || props.copyingPrompt || props.running || props.saving}
        >
          {props.copyingPrompt ? "Copying..." : "Copy generation prompt"}
        </Button>
        <Button
          variant="outlined"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={() => {
            props.onCheckerScriptChange(editorValue);
            props.onRun();
          }}
          disabled={props.generating || props.running || props.saving}
        >
          {props.running ? "Running..." : "Run on model solution"}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          onClick={() => {
            props.onCheckerScriptChange(editorValue);
            props.onSave();
          }}
          disabled={props.generating || props.running || props.saving}
        >
          {props.saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

