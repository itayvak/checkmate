import { createTheme } from "@mui/material";
import { CheckRounded, CloseRounded } from "@mui/icons-material";

//--color-surface-container-lowest: #0C0E12;
//--color-surface-container-low: #191C20;
//--color-surface-container: #1D2024;
//--color-surface-container-high: #282A2E;
//--color-surface-container-highest: #333539;

export const colors = { 
  primary: "#a4c9ff", 
  surfaceTint: "#a4c9ff", 
  onPrimary: "#00315d", 
  primaryContainer: "#004a87", 
  onPrimaryContainer: "#89bbff", 
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
  background: "#111318", 
  onBackground: "#e1e2e8", 
  surface: "#111318", 
  onSurface: "#e1e2e8", 
  surfaceVariant: "#424750", 
  onSurfaceVariant: "#c2c6d1", 
  outline: "#8c919b", 
  outlineVariant: "#424750",
  surfaceContainerLowest: "#0C0E12",
  surfaceContainerLow: "#191C20",
  surfaceContainer: "#1D2024",
  surfaceContainerHigh: "#232529",
  surfaceContainerHighest: "#27292D",
};

export const borderRadius = {
  normal: 8,
  small: 8,
}
  
export const font = {
  monospace: '"JetBrains Mono", "Consolas", monospace',
  normal: '"Google Sans", "Roboto", sans-serif',
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
        main: colors.primary,
        contrastText: colors.onPrimary
    },
    background: {
        default: colors.background,
        paper: colors.surface,
    },
    text: {
        primary: colors.onBackground
    },
    error: {
        main: colors.error,
        contrastText: colors.onError
    },
    warning: {
        main: colors.warning,
        contrastText: colors.onWarning
    },
    info: {
        main: colors.primary,
        contrastText: colors.onPrimary
    },
    success: {
        main: colors.success,
        contrastText: colors.onSuccess
    }
  },
  typography: {
      fontFamily: font.normal,
      allVariants: {
        fontWeight: 'normal'
      },
      button: {
        textTransform: 'none'
      }
  },
  shape: {
    borderRadius: borderRadius.normal
  },
  spacing: 14,
  shadows: ['none','','','','','','','','','','','','','','','','','','','','','','','',''],
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation0: { backgroundColor: colors.surface },
        elevation1: { backgroundColor: colors.surfaceContainerLow },
        elevation2: { backgroundColor: colors.surfaceContainer },
        elevation3: { backgroundColor: colors.surfaceContainerHigh },
        elevation4: { backgroundColor: colors.surfaceContainerHighest },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          fontSize: '14px',
          height: '40px',
          padding: '0 18px',
        },
        outlinedPrimary: {
          borderColor: colors.outline,
        },
        outlinedError: {
          borderColor: colors.outline,
          color: colors.error,
        },
      },
      variants: [
        {
          props: { size: "small" },
          style: {
            height: '32px',
            padding: '0 14px',
          }
        }
      ]
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          boxShadow: '0px 0px 50px 10px rgba(0,0,0,0.5)',
          backgroundColor: colors.surfaceContainerHigh,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '2rem',
          fontWeight: 'normal',
          paddingTop: '24px'
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '24px'
        }
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          paddingBottom: '0'
        }
      }
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          padding: '16px',
          justifyContent: 'flex-end'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.small
        }
      }
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          paddingLeft: '12px',
          paddingRight: '12px'
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: borderRadius.small
        }
      }
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.small
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.small
        }
      },
      // error is x mark
      defaultProps: {
        iconMapping: {
          success: <CheckRounded />,
          error: <CloseRounded />,
        }
      },
      variants: [
        {
          props: { severity: "success" },
          style: {
            backgroundColor: colors.successContainer,
            color: colors.onSuccessContainer,
          }
        },
        {
          props: { severity: "error" },
          style: {
            backgroundColor: colors.errorContainer,
            color: colors.onErrorContainer,
          }
        },
        {
          props: { severity: "warning" },
          style: {
            backgroundColor: colors.warningContainer,
            color: colors.onWarningContainer,
          }
        },
        {
          props: { severity: "info" },
          style: {
            backgroundColor: colors.primaryContainer,
            color: colors.onPrimaryContainer,
          }
        },
      ]
    },
  }
});