import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import CommentRoundedIcon from "@mui/icons-material/CommentRounded";

type Props = {
  projectName: string;
  onOpenSettings: (anchorEl: HTMLElement) => void;
  onCheckRunAll: () => void;
  checkRunAllDisabled: boolean;
  checkRunAllPending: boolean;
};

export default function WorkspaceTopBar({
  projectName,
  onOpenSettings,
  onCheckRunAll,
  checkRunAllDisabled,
  checkRunAllPending,
}: Props) {
  return (
    <AppBar position="static">
      <Toolbar disableGutters variant="dense">
        <IconButton
          sx={{ mr: "4px" }}
          onClick={() => {
            window.location.href = "/";
          }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h6" color="inherit" component="div">
          {projectName}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={0.5}>
          <Button
            variant="contained"
            disabled={checkRunAllDisabled}
            onClick={onCheckRunAll}
            startIcon={
              checkRunAllPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PlayArrowRoundedIcon />
              )
            }
          >
            Check run all
          </Button>
          <Button variant="contained" startIcon={<CommentRoundedIcon />}>
            Annotate all
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsRoundedIcon />}
            onClick={(e) => onOpenSettings(e.currentTarget)}
          >
            Settings
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

