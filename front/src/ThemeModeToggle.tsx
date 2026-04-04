import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { IconButton, Tooltip } from "@mui/material";
import { useColorMode } from "./ColorModeContext.tsx";

type Props = {
  /** Tooltip when in dark mode (action switches to light). */
  lightLabel?: string;
  /** Tooltip when in light mode (action switches to dark). */
  darkLabel?: string;
};

export default function ThemeModeToggle({
  lightLabel = "Light mode",
  darkLabel = "Dark mode",
}: Props) {
  const { mode, toggleColorMode } = useColorMode();
  const isDark = mode === "dark";
  return (
    <Tooltip title={isDark ? lightLabel : darkLabel}>
      <IconButton
        type="button"
        color="inherit"
        onClick={toggleColorMode}
        aria-label={isDark ? lightLabel : darkLabel}
        size="small"
      >
        {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}
