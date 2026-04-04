import { createTheme, type PaletteMode } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { CheckRounded, CloseRounded, WarningAmberRounded, WarningRounded } from "@mui/icons-material";

const colorsDark = {
  primary: "#B8B1FC",
  surfaceTint: "#C5C0FF",
  onPrimary: "#2D2960",
  primaryContainer: "#444078",
  onPrimaryContainer: "#E3DFFF",
  error: "#E26858",
  onError: "#690005",
  errorContainer: "#312425",
  onErrorContainer: "#ffdad6",
  success: "#2FA857",
  onSuccess: "#004a42",
  successContainer: "#202E29",
  onSuccessContainer: "#D5EAE2",
  warning: "#ffdc8a",
  onWarning: "#695000",
  warningContainer: "#937000",
  onWarningContainer: "#ffedcc",
  background: "#131318",
  onBackground: "#E5E1E9",
  surface: "#131318",
  onSurface: "#E5E1E9",
  surfaceVariant: "#47464F",
  onSurfaceVariant: "#C8C5D0",
  outline: "#928F99",
  outlineVariant: "#47464F",
  surfaceContainerLowest: "#0E0E13",
  surfaceContainerLow: "#1C1B20",
  surfaceContainer: "#201F25",
  surfaceContainerHigh: "#2A292F",
  surfaceContainerHighest: "#35343A"
};

const colorsLight = {
  primary: "#5c57a1",
  surfaceTint: "#5C5891",
  onPrimary: "#FFFFFF",
  primaryContainer: "#E3DFFF",
  onPrimaryContainer: "#444078",
  error: "#BA1A1A",
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#93000A",
  success: "#2FA857",
  onSuccess: "#004a42",
  successContainer: "#D3F2E5",
  onSuccessContainer: "#223832",
  warning: "#D48B46",
  onWarning: "#382A01",
  warningContainer: "#FFDEB5",
  onWarningContainer: "#523910",
  background: "#FCF8FF",
  onBackground: "#1C1B20",
  surface: "#FCF8FF",
  onSurface: "#1C1B20",
  surfaceVariant: "#E5E1EC",
  onSurfaceVariant: "#47464F",
  outline: "#787680",
  outlineVariant: "#C8C5D0",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#F6F2FA",
  surfaceContainer: "#F0ECF4",
  surfaceContainerHigh: "#EBE7EF",
  surfaceContainerHighest: "#E5E1E9"
};

export type AppColors = typeof colorsLight;

/** Colors from the theme (`useAppColors`) include the active palette mode. */
export type AppThemeColors = AppColors & { mode: PaletteMode };

export const borderRadius = {
  normal: 24,
  small: 8,
};

export const font = {
  monospace: '"JetBrains Mono", "Consolas", monospace',
  normal: '"Google Sans", "Roboto", sans-serif',
};

function buildTheme(mode: PaletteMode, c: AppColors) {
  const dialogShadow =
    mode === "dark"
      ? "0px 0px 50px 10px rgba(0,0,0,0.5)"
      : "0px 8px 40px rgba(0,0,0,0.12)";

  return createTheme({
    appColors: { ...c, mode },
    palette: {
      mode,
      primary: {
        main: c.primary,
        contrastText: c.onPrimary,
      },
      background: {
        default: c.background,
        paper: c.surface,
      },
      text: {
        primary: c.onBackground,
      },
      error: {
        main: c.error,
        contrastText: c.onError,
      },
      warning: {
        main: c.warning,
        contrastText: c.onWarning,
      },
      info: {
        main: c.primary,
        contrastText: c.onPrimary,
      },
      success: {
        main: c.success,
        contrastText: c.onSuccess,
      },
    },
    typography: {
      fontFamily: font.normal,
      allVariants: {
        fontWeight: "normal",
      },
      button: {
        textTransform: "none",
      },
    },
    shape: {
      borderRadius: borderRadius.normal,
    },
    spacing: 14,
    shadows: [
      "none",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
          elevation0: { backgroundColor: c.surface },
          elevation1: { backgroundColor: c.surfaceContainerLow },
          elevation2: { backgroundColor: c.surfaceContainer },
          elevation3: { backgroundColor: c.surfaceContainerHigh },
          elevation4: { backgroundColor: c.surfaceContainerHighest },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            fontSize: "14px",
            height: "40px",
            padding: "0 18px",
          },
          outlinedPrimary: {
            borderColor: c.outline,
          },
          outlinedError: {
            borderColor: c.outline,
            color: c.error,
          },
        },
        variants: [
          {
            props: { size: "small" },
            style: {
              height: "32px",
              padding: "0 14px",
            },
          },
        ],
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            boxShadow: dialogShadow,
            backgroundColor: c.surfaceContainerHigh,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontSize: "2rem",
            fontWeight: "normal",
            paddingTop: "24px",
          },
        },
      },
      MuiDialogContentText: {
        styleOverrides: {
          root: {
            fontSize: "14px",
            marginBottom: "16px",
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: "24px",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: c.surfaceContainerHighest,
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            paddingBottom: "0",
          },
        },
      },
      MuiCardActions: {
        styleOverrides: {
          root: {
            padding: "16px",
            justifyContent: "flex-end",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: borderRadius.small,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            paddingLeft: "12px",
            paddingRight: "12px",
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: borderRadius.small,
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            borderRadius: borderRadius.small,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: borderRadius.small,
          },
        },
        defaultProps: {
          iconMapping: {
            success: <CheckRounded />,
            error: <CloseRounded />,
            warning: <WarningAmberRounded />,
          },
        },
        variants: [
          {
            props: { severity: "success" },
            style: {
              backgroundColor: c.successContainer,
              color: c.onSuccessContainer,
            },
          },
          {
            props: { severity: "error" },
            style: {
              backgroundColor: c.errorContainer,
              color: c.onErrorContainer,
            },
          },
          {
            props: { severity: "warning" },
            style: {
              backgroundColor: c.warningContainer,
              color: c.onWarningContainer,
            },
          },
          {
            props: { severity: "info" },
            style: {
              backgroundColor: c.primaryContainer,
              color: c.onPrimaryContainer,
            },
          },
        ],
      },
    },
  });
}

export function createAppTheme(mode: PaletteMode) {
  const c = mode === "dark" ? colorsDark : colorsLight;
  return buildTheme(mode, c);
}

/** Semantic app palette for the active light/dark mode (from ThemeProvider). */
export function useAppColors() {
  return useTheme().appColors;
}

declare module "@mui/material/styles" {
  interface Theme {
    appColors: AppThemeColors;
  }
  interface ThemeOptions {
    appColors?: AppThemeColors;
  }
}
