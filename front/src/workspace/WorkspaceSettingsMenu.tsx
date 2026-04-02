import { Menu, MenuItem } from "@mui/material";
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
      <MenuItem onClick={props.onAiSettings}>
        <SmartToyRoundedIcon fontSize="small" sx={{ mr: 1 }} />
        AI settings
      </MenuItem>
      <MenuItem onClick={props.onCheckerScript}>
        <BuildRoundedIcon fontSize="small" sx={{ mr: 1 }} />
        Checker script
      </MenuItem>
      <MenuItem onClick={props.onCommentLibrary}>
        <CommentRoundedIcon fontSize="small" sx={{ mr: 1 }} />
        Comment library
      </MenuItem>
    </Menu>
  );
}

