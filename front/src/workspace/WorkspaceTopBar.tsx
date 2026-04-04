import {
  AppBar,
  Badge,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { AutoFixHighRounded, TerminalRounded } from "@mui/icons-material";
import ThemeModeToggle from "../ThemeModeToggle.tsx";

type Props = {
  projectName: string;
  onOpenSettings: (anchorEl: HTMLElement) => void;
  onCheckRunAll: () => void;
  checkRunAllDisabled: boolean;
  checkRunAllPending: boolean;
  onAnnotateAll: () => void;
  annotateAllDisabled: boolean;
  annotateAllPending: boolean;
  apiKeyMissing: boolean;
  checkerScriptMissing: boolean;
};

export default function WorkspaceTopBar({
  projectName,
  onOpenSettings,
  onCheckRunAll,
  checkRunAllDisabled,
  checkRunAllPending,
  onAnnotateAll,
  annotateAllDisabled,
  annotateAllPending,
  apiKeyMissing,
  checkerScriptMissing,
}: Props) {
  const settingsAttention = apiKeyMissing || checkerScriptMissing;
  const settingsTitle =
    apiKeyMissing && checkerScriptMissing
      ? "Set an API key for AI features and add a checker script to run checks."
      : apiKeyMissing
        ? "You need to set an API key to use AI features."
        : checkerScriptMissing
          ? "Add a checker script in Settings to run checks on student code."
          : undefined;

  return (
    <AppBar position="static" color="default">
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
          <ThemeModeToggle />
          <Button
            variant="contained"
            disabled={checkRunAllDisabled}
            onClick={onCheckRunAll}
            startIcon={
              checkRunAllPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <TerminalRounded />
              )
            }
          >
            Check run all
          </Button>
          <Button
            variant="contained"
            disabled={annotateAllDisabled}
            onClick={onAnnotateAll}
            startIcon={
              annotateAllPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AutoFixHighRounded />
              )
            }
          >
            Annotate all
          </Button>
          <Badge
            color="error"
            variant="dot"
            invisible={!settingsAttention}
            overlap="rectangular"
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Button
              variant="outlined"
              startIcon={<SettingsRoundedIcon />}
              onClick={(e) => onOpenSettings(e.currentTarget)}
              title={settingsTitle}
            >
              Settings
            </Button>
          </Badge>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

