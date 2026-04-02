import { type ChangeEvent, type RefObject } from "react";
import {
  Box,
  Button,
  List,
  ListItemButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import type { WorkspaceStudent } from "../api";
import SourceCheckBadge from "./SourceCheckBadge";

type Props = {
  students: WorkspaceStudent[];
  selectedFilename: string | null;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelectFilename: (filename: string) => void;
  onUploadFilesSelected: (e: ChangeEvent<HTMLInputElement>) => void;
};

export default function SourcesSidebar(props: Props) {
  return (
    <Paper
      square
      elevation={4}
      sx={{
        width: 280,
        minWidth: 280,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          Sources
        </Typography>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>
          <Typography variant="body2" component="span">
            {props.students.length} total
          </Typography>
        </Stack>
      </Box>

      <List dense sx={{ flex: 1, overflow: "auto" }}>
        {props.students.map((s) => (
          <ListItemButton
            key={s.filename}
            selected={s.filename === props.selectedFilename}
            onClick={() => props.onSelectFilename(s.filename)}
            sx={{
              alignItems: "center",
              gap: 0.75,
              py: 0.75,
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}
            >
              {s.filename}
            </Typography>
            <SourceCheckBadge check={s.check} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ p: 1.5 }}>
        <input
          ref={props.fileInputRef}
          type="file"
          hidden
          multiple
          accept=".py"
          onChange={props.onUploadFilesSelected}
        />
        <Button
          fullWidth
          variant="outlined"
          startIcon={<UploadFileRoundedIcon />}
          disabled={props.uploading}
          onClick={() => props.fileInputRef.current?.click()}
        >
          Upload source files
        </Button>
      </Box>
    </Paper>
  );
}

