import { useMemo } from "react";
import ProjectsListPage from "./ProjectsListPage.tsx";
import ProjectWorkspacePage from "./ProjectWorkspacePage.tsx";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { ColorModeProvider, useColorMode } from "./ColorModeContext.tsx";
import { borderRadius, createAppTheme } from "./MuiTheme.tsx";

function AppThemed() {
  const { mode } = useColorMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const appGlobalStyles = (
    <GlobalStyles
      styles={(t) => ({
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: `${t.palette.divider} ${t.palette.background.default}`,
        },
        "*::-webkit-scrollbar": {
          width: 10,
          height: 10,
        },
        "*::-webkit-scrollbar-track": {
          backgroundColor: t.palette.background.default,
        },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: t.palette.divider,
          borderRadius: borderRadius.small,
          border: `2px solid ${t.palette.background.default}`,
        },
        "*::-webkit-scrollbar-thumb:hover": {
          backgroundColor: t.palette.action.active,
        },
        "*::-webkit-scrollbar-corner": {
          backgroundColor: t.palette.background.default,
        },
      })}
    />
  );

  const path = window.location.pathname;
  const workspaceMatch = path.match(/^\/projects\/([^/]+)$/);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {appGlobalStyles}
      {workspaceMatch ? (
        <ProjectWorkspacePage projectId={decodeURIComponent(workspaceMatch[1])} />
      ) : (
        <ProjectsListPage />
      )}
    </ThemeProvider>
  );
}

function App() {
  return (
    <ColorModeProvider>
      <AppThemed />
    </ColorModeProvider>
  );
}

export default App;
