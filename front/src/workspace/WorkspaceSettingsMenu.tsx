import { Box, Menu, MenuItem } from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import CommentRoundedIcon from "@mui/icons-material/CommentRounded";

type Props = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onProjectSettings: () => void;
  onAiSettings: () => void;
  onCheckerScript: () => void;
  onCommentLibrary: () => void;
  /** When true, shows a reminder on "AI settings" (API key not configured). */
  apiKeyMissing: boolean;
  /** When true, shows a reminder on "Checker script" (no script configured). */
  checkerScriptMissing: boolean;
};

export default function WorkspaceSettingsMenu(props: Props) {
  return (
    <Menu
      anchorEl={props.anchorEl}
      open={props.open}
      onClose={props.onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <MenuItem onClick={props.onProjectSettings}>
        <TuneRoundedIcon fontSize="small" sx={{ mr: 1 }} />
        Project settings
      </MenuItem>
      <MenuItem
        onClick={props.onAiSettings}
        sx={{ gap: 1, pr: 1.5, alignItems: "center" }}
        title={
          props.apiKeyMissing
            ? "Set your Gemini API key here"
            : undefined
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
          <SmartToyRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          AI settings
        </Box>
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: "50%",
            bgcolor: "error.main",
            visibility: props.apiKeyMissing ? "visible" : "hidden",
          }}
        />
      </MenuItem>
      <MenuItem
        onClick={props.onCheckerScript}
        sx={{ gap: 1, pr: 1.5, alignItems: "center" }}
        title={
          props.checkerScriptMissing
            ? "Add a checker script here to run checks"
            : undefined
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
          <BuildRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          Checker script
        </Box>
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: "50%",
            bgcolor: "error.main",
            visibility: props.checkerScriptMissing ? "visible" : "hidden",
          }}
        />
      </MenuItem>
      <MenuItem onClick={props.onCommentLibrary}>
        <CommentRoundedIcon fontSize="small" sx={{ mr: 1 }} />
        Comment library
      </MenuItem>
    </Menu>
  );
}

