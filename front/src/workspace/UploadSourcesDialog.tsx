import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import FileSelectButton from "../FileSelectButton";

type Props = {
  open: boolean;
  uploading: boolean;
  onClose: () => void;
  onConfirm: (files: File[]) => void | Promise<void>;
};

export default function UploadSourcesDialog(props: Props) {
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!props.open) return;
    setFiles([]);
  }, [props.open]);

  const handleClose = () => {
    if (props.uploading) return;
    props.onClose();
  };

  const handleConfirm = async () => {
    if (files.length === 0 || props.uploading) return;
    await props.onConfirm(files);
  };

  return (
    <Dialog
      open={props.open}
      onClose={() => handleClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Upload source files</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <FileSelectButton
            multiple
            placeholder="Choose .py files"
            accept=".py"
            files={files}
            onFilesChange={setFiles}
            fullWidth
            disabled={props.uploading}
          />
          {files.length > 0 ? (
            <Stack spacing={0.75}>
              <Typography variant="subtitle2" color="text.secondary">
                Files to upload ({files.length})
              </Typography>
              <List
                dense
                disablePadding
                sx={{
                  maxHeight: 220,
                  overflow: "auto",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                {files.map((f) => (
                  <ListItem key={`${f.name}-${f.size}-${f.lastModified}`} disablePadding sx={{ px: 1.5, py: 0.5 }}>
                    <ListItemText
                      primary={f.name}
                      primaryTypographyProps={{
                        variant: "body2",
                        sx: { fontFamily: "monospace", wordBreak: "break-all" },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} disabled={props.uploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={files.length === 0 || props.uploading}
        >
          {props.uploading ? "Uploading…" : "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
