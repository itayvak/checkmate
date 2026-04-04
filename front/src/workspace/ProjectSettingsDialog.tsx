import { type ChangeEvent } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import FileSelectButton from "../FileSelectButton";

type Props = {
  open: boolean;
  projectNameInput: string;
  assignmentName: string;
  modelSolutionName: string;
  assignmentFile: File | null;
  modelFile: File | null;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onProjectNameChange: (value: string) => void;
  onAssignmentFileChange: (file: File | null) => void;
  onModelFileChange: (file: File | null) => void;
};

export default function ProjectSettingsDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Project settings</DialogTitle>
      <DialogContent>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <TextField
            label="Project name"
            value={props.projectNameInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => props.onProjectNameChange(e.target.value)}
            inputProps={{ maxLength: 200 }}
            autoComplete="off"
            fullWidth
          />
          <FileSelectButton
            placeholder="Replace assignment description markdown"
            accept=".md,.txt"
            file={props.assignmentFile}
            onFileChange={props.onAssignmentFileChange}
            fullWidth
            disabled={props.saving}
          />
          <Typography variant="caption" color="text.secondary">
            Current assignment description: {props.assignmentName || "(none)"}
          </Typography>

          <FileSelectButton
            placeholder="Replace model solution"
            accept=".py"
            file={props.modelFile}
            onFileChange={props.onModelFileChange}
            fullWidth
            disabled={props.saving}
          />
          <Typography variant="caption" color="text.secondary">
            Current model solution: {props.modelSolutionName || "(none)"}
          </Typography>

          {props.error ? <Alert severity="error">{props.error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose} disabled={props.saving}>
          Close
        </Button>
        <Button variant="contained" onClick={props.onSave} disabled={props.saving}>
          {props.saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

