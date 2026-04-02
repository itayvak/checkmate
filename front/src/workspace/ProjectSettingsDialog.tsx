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
          <Button variant="outlined" component="label">
            Replace assignment description markdown
            <input
              type="file"
              hidden
              accept=".md,.markdown,text/markdown,.txt,text/plain"
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onAssignmentFileChange(e.target.files?.[0] ?? null)
              }
            />
          </Button>
          <Typography variant="caption" color="text.secondary">
            {props.assignmentFile &&
              `Selected: ${props.assignmentFile.name}`
            }
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Current assignment description: {props.assignmentName || "(none)"}
          </Typography>

          <Button variant="outlined" component="label">
            Replace model solution
            <input
              type="file"
              hidden
              accept=".py,text/x-python"
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onModelFileChange(e.target.files?.[0] ?? null)
              }
            />
          </Button>
          <Typography variant="caption" color="text.secondary">
            {props.modelFile && `Selected: ${props.modelFile.name}`}
          </Typography>

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

