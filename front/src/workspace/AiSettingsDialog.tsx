import { type ChangeEvent } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

type Props = {
  open: boolean;
  apiKey: string;
  modelName: string;
  modelOptions: string[];
  onClose: () => void;
  onSave: () => void;
  onApiKeyChange: (value: string) => void;
  onModelNameChange: (value: string) => void;
};

export default function AiSettingsDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>AI settings</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          These settings are stored locally - your API key will not be shared.
        </DialogContentText>
        <Stack spacing={1}>
          <TextField
            label="Gemini API key"
            type="password"
            value={props.apiKey}
            onChange={(e: ChangeEvent<HTMLInputElement>) => props.onApiKeyChange(e.target.value)}
            autoComplete="off"
            fullWidth
          />
          <Typography variant="caption" color="text.secondary">
            Need a key?{" "}
            <Link href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
              Open Gemini API keys
            </Link>
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="model-select-label">Model</InputLabel>
            <Select
              labelId="model-select-label"
              label="Model"
              value={props.modelName}
              onChange={(e: SelectChangeEvent) => props.onModelNameChange(e.target.value)}
            >
              {props.modelOptions.map((model) => (
                <MenuItem key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose}>
          Close
        </Button>
        <Button variant="contained" onClick={props.onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

