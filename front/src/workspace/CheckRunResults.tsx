import { useState, type ReactNode } from "react";
import { Alert, Button, Collapse, Stack, Typography } from "@mui/material";
import type { RunCheckerResponse } from "../api";
import { CodeRounded } from "@mui/icons-material";

type Props = {
  result: RunCheckerResponse;
};

function CollapsibleFailedOutput({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="small"
        variant="text"
        onClick={() => setOpen((v) => !v)}
        sx={{ alignSelf: "flex-start", p: 0.2, height: "fit-content", color: "text.secondary"}}
        startIcon={<CodeRounded fontSize="small" />}
      >
        {open ? "Hide output" : "Show output"}
      </Button>
      <Collapse in={open}>{children}</Collapse>
    </>
  );
}

export default function CheckRunResults({ result }: Props) {
  if (!result.ok) return <Alert severity="error">{result.error || "Run failed."}</Alert>;

  if (result.check_cases && result.check_cases.length > 0) {
    return (
      <Stack spacing={0.3}>
        {result.check_cases.map((tc, idx) => (
          <Alert key={`${tc.name || "case"}-${idx}`} severity={tc.passed ? "success" : "error"}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {tc.name || `Test case #${idx + 1}`} - {tc.passed ? "Pass" : "Fail"}
            </Typography>
            {!tc.passed && (tc.output || tc.message) ? (
              <CollapsibleFailedOutput>
                <Typography
                  component="pre"
                  sx={{ mb: 0, mt: 0.5, whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}
                >
                  {String(tc.output || tc.message || "")}
                </Typography>
              </CollapsibleFailedOutput>
            ) : null}
          </Alert>
        ))}
      </Stack>
    );
  }

  const failedRun = result.exit_code !== 0;
  const body = (
    <Typography
      component="pre"
      sx={{ mb: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}
    >
      {result.output || "(no output)"}
    </Typography>
  );

  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        {result.exit_code === 0 ? "check run passed" : result.exit_code === null ? "error" : `exit ${result.exit_code}`}
      </Typography>
      {failedRun ? <CollapsibleFailedOutput>{body}</CollapsibleFailedOutput> : body}
    </Stack>
  );
}

