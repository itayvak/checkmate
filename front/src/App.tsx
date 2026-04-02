import ProjectsListPage from "./ProjectsListPage.tsx";
import ProjectWorkspacePage from "./ProjectWorkspacePage.tsx";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "./MuiTheme.tsx";

function App() {
  const path = window.location.pathname;
  const workspaceMatch = path.match(/^\/projects\/([^/]+)$/);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {workspaceMatch ? (
        <ProjectWorkspacePage projectId={decodeURIComponent(workspaceMatch[1])} />
      ) : (
        <ProjectsListPage />
      )}
    </ThemeProvider>
  );
}

export default App;
