import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Paper,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { font, useAppColors } from "../MuiTheme.tsx";
import { checkmateCodeThemeId, defineCheckmateCodeThemes } from "./monacoCheckmateTheme";

type ReferenceMaterialsTab = "assignment" | "model";

type Props = {
  open: boolean;
  onClose: () => void;
  assignmentMd: string;
  modelSolutionPy: string;
};

function AssignmentMarkdown({ markdown }: { markdown: string }) {
  const theme = useTheme();
  const colors = useAppColors();
  const prismStyle = theme.palette.mode === "dark" ? oneDark : oneLight;

  const components: Components = useMemo(
    () => ({
      code({ className, children }) {
        const codeText = String(children).replace(/\n$/, "");
        const match = /language-(\w+)/.exec(className || "");
        const isBlock = Boolean(match) || codeText.includes("\n");
        if (!isBlock) {
          return (
            <Box
              component="code"
              dir="ltr"
              sx={{
                direction: "ltr",
                unicodeBidi: "embed",
                fontFamily: font.monospace,
                fontSize: "0.88em",
                bgcolor: "action.selected",
                color: "text.primary",
                px: 0.6,
                py: 0.15,
                borderRadius: 0.75,
                wordBreak: "break-word",
              }}
            >
              {children}
            </Box>
          );
        }
        const lang = match ? match[1] : "plaintext";
        return (
          <Box dir="ltr" sx={{ direction: "ltr", my: 1.5 }}>
            <SyntaxHighlighter
              language={lang}
              style={prismStyle}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: "12px 14px",
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.55,
                background: colors.surfaceContainerLow,
              }}
              codeTagProps={{
                style: {
                  fontFamily: font.monospace,
                },
              }}
            >
              {codeText}
            </SyntaxHighlighter>
          </Box>
        );
      },
      pre({ children }) {
        return <>{children}</>;
      },
    }),
    [prismStyle, colors.surfaceContainerLow],
  );

  return (
    <Box
      dir="rtl"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        direction: "rtl",
        color: "text.primary",
        fontSize: 15,
        lineHeight: 1.65,
        WebkitOverflowScrolling: "touch",
        "& h1": {
          fontSize: "1.5rem",
          fontWeight: 700,
          mt: 2.5,
          mb: 1.25,
          lineHeight: 1.3,
          "&:first-of-type": { mt: 0 },
        },
        "& h2": {
          fontSize: "1.25rem",
          fontWeight: 650,
          mt: 2,
          mb: 1,
          lineHeight: 1.35,
        },
        "& h3": {
          fontSize: "1.1rem",
          fontWeight: 600,
          mt: 1.75,
          mb: 0.75,
        },
        "& h4, & h5, & h6": { fontWeight: 600, mt: 1.5, mb: 0.5 },
        "& p": { mb: 1.25 },
        "& ul, & ol": { paddingInlineStart: 2.5, mb: 1.25 },
        "& li": { mb: 0.35 },
        "& li > p": { mb: 0.5 },
        "& blockquote": {
          borderInlineStart: 4,
          borderInlineStartStyle: "solid",
          borderInlineStartColor: "primary.main",
          paddingInlineStart: 2,
          my: 1.5,
          color: "text.secondary",
        },
        "& a": { color: "primary.main", wordBreak: "break-word" },
        "& hr": { borderColor: "divider", my: 2.5 },
        "& table": {
          borderCollapse: "collapse",
          width: "100%",
          my: 1.5,
          fontSize: 14,
        },
        "& th, & td": {
          border: 1,
          borderColor: "divider",
          px: 1.25,
          py: 0.75,
          textAlign: "start",
        },
        "& th": { bgcolor: "action.hover", fontWeight: 600 },
        "& img": { maxWidth: "100%", height: "auto", borderRadius: 1 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </Box>
  );
}

function PythonSourceView({ code }: { code: string }) {
  const colors = useAppColors();
  const monacoTheme = checkmateCodeThemeId(colors.mode);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box sx={{ position: "absolute", inset: 0 }}>
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="python"
          language="python"
          theme={monacoTheme}
          key={monacoTheme}
          beforeMount={(monaco) => defineCheckmateCodeThemes(monaco, colors.surfaceContainerLow)}
          value={code.replace(/\n$/, "")}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </Box>
    </Box>
  );
}

export default function ReferenceMaterialsDialog({
  open,
  onClose,
  assignmentMd,
  modelSolutionPy,
}: Props) {
  const [tab, setTab] = useState<ReferenceMaterialsTab>("assignment");

  useEffect(() => {
    if (!open) return;
    const hasAssignment = assignmentMd.trim().length > 0;
    const hasModel = modelSolutionPy.trim().length > 0;
    if (!hasAssignment && hasModel) setTab("model");
    else if (hasAssignment && !hasModel) setTab("assignment");
  }, [open, assignmentMd, modelSolutionPy]);

  const isEmpty =
    tab === "assignment" ? !assignmentMd.trim() : !modelSolutionPy.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          // Explicit height so flex children (DialogContent → Paper → Monaco) get a real size;
          // maxHeight alone lets the paper shrink to content and height:100% in Monaco collapses.
          height: "min(90vh, 800px)",
          maxHeight: "min(90vh, 800px)",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>{tab === "assignment" ? "Assignment description" : "Model solution"}</DialogTitle>
      <DialogContent
        sx={{
          flex: "1 1 0",
          minHeight: 0,
          overflow: "hidden",
          overflowY: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack
          spacing={1.5}
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <Paper
            elevation={1}
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: tab === "assignment" ? 2.5 : 0,
            }}
          >
            {isEmpty ? (
              <Typography
                color="text.secondary"
                dir={tab === "assignment" ? "rtl" : undefined}
                sx={{
                  p: tab === "model" ? 2 : undefined,
                  ...(tab === "assignment" ? { direction: "rtl" } : {}),
                }}
              >
                {tab === "assignment"
                  ? "No assignment description uploaded. Add one in Settings."
                  : "No model solution uploaded. Add one in Settings."}
              </Typography>
            ) : tab === "assignment" ? (
              <AssignmentMarkdown markdown={assignmentMd} />
            ) : (
              <PythonSourceView code={modelSolutionPy} />
            )}
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <ToggleButtonGroup
          exclusive
          value={tab}
          onChange={(_, v: ReferenceMaterialsTab | null) => v && setTab(v)}
          size="small"
          color="primary"
          sx={{ flexShrink: 0, alignSelf: "flex-start" }}
        >
          <ToggleButton value="assignment">Assignment</ToggleButton>
          <ToggleButton value="model">Model solution</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
