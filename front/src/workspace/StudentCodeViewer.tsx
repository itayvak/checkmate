import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Paper, Typography } from "@mui/material";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { addProjectAnnotation, type LineAnnotation, type ProjectComment } from "../api";
import { useAppColors } from "../MuiTheme";
import ReplaceStaleAnnotationDialog from "./ReplaceStaleAnnotationDialog";
import { checkmateCodeThemeId, defineCheckmateCodeThemes } from "./monacoCheckmateTheme";
import { buildLineAnnotationMap } from "./lineAnnotations";

/** Inset cards from rail edges + small horizontal nudge so selection stays inside the scrollport. */
const ANNOTATION_RAIL_CARD_INSET = { left: 16, right: 16 } as const;
const SELECTED_ANNOTATION_NUDGE_X = 16;
/** Extra scroll height past last card so the selected nudge/shadow are not clipped at the bottom. */
const ANNOTATION_RAIL_BOTTOM_SLACK = 20;

type Props = {
  code: string;
  annotations?: LineAnnotation[];
  commentLibrary: ProjectComment[];
  projectId: string;
  sourceFilename: string;
  workspaceBusy?: boolean;
  onAnnotationsChanged?: () => void;
  /** When set with a line number, that line is highlighted; clicks do not change selection. */
  reviewMode?: boolean;
  reviewFocusLine?: number | null;
};

function InlineAnnotationCard({
  lineNum,
  title,
  details,
  showDetails,
  active,
  staleLibraryRef,
  replaceDisabled,
  reviewMode,
  onSelect,
  onReplaceRequest,
}: {
  lineNum: number;
  title: string;
  details: string;
  showDetails: boolean;
  active: boolean;
  staleLibraryRef?: boolean;
  replaceDisabled?: boolean;
  reviewMode?: boolean;
  onSelect: () => void;
  onReplaceRequest?: () => void;
}) {
  const colors = useAppColors();
  const replaceBlocked = Boolean(staleLibraryRef && replaceDisabled);
  return (
    <Alert
      onClick={(e) => {
        e.stopPropagation();
        if (reviewMode) return;
        if (replaceBlocked) {
          onSelect();
          return;
        }
        staleLibraryRef ? onReplaceRequest?.() : onSelect();
      }}
      severity="error"
      icon={false}
      sx={{
        maxWidth: "450px",
        cursor: replaceBlocked ? "not-allowed" : "pointer",
        borderStyle: "solid",
        borderWidth: "2px",
        borderColor: active
          ? colors.error
          : colors.errorContainer,
        boxShadow: active ? 3 : 0,
        transition: "border-color 0.12s ease, box-shadow 0.12s ease",
      }}
      dir="rtl"
    >
      <Typography variant="caption">Line {lineNum}</Typography>
      <br />
      <Typography variant="body2">
        {title}
      </Typography>
      {staleLibraryRef ? (
        <Typography variant="caption" sx={{ display: "block", mt: 0.75, whiteSpace: "pre-wrap" }}>
          (Click to replace with another comment)
        </Typography>
      ) : null}
      {showDetails && details.trim() ? (
        <Typography variant="caption" sx={{ display: "block", mt: 0.75, whiteSpace: "pre-wrap" }}>
          {details}
        </Typography>
      ) : null}
    </Alert>
  );
}

export default function StudentCodeViewer({
  code,
  annotations,
  commentLibrary,
  projectId,
  sourceFilename,
  workspaceBusy,
  onAnnotationsChanged,
  reviewMode = false,
  reviewFocusLine = null,
}: Props) {
  const colors = useAppColors();
  const monacoThemeName = checkmateCodeThemeId(colors.mode);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const commentsPaneRef = useRef<HTMLDivElement | null>(null);
  const editorDisposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const metricsRafIdRef = useRef<number | null>(null);
  const annotatedLineDecorationClassName = "checkmate-annotated-line";
  const annotatedLineDecorationActiveClassName = "checkmate-annotated-line-active";
  /** Inline layer only — `className` paints behind tokens, so cursor must be set here to override I-beam. */
  const annotatedLineDecorationHitClassName = "checkmate-annotated-line-hit";
  const annotatedLineDecorationIdsRef = useRef<string[]>([]);
  const [activeAnnotatedLine, setActiveAnnotatedLine] = useState<number | null>(null);
  const [editorMetrics, setEditorMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    contentHeight: 0,
  });
  const cardHeightsRef = useRef<Map<number, number>>(new Map());
  const [cardHeightsVersion, setCardHeightsVersion] = useState(0);
  const [commentsListDetached, setCommentsListDetached] = useState(false);
  const commentsListDetachedRef = useRef(false);
  const [replaceLine, setReplaceLine] = useState<number | null>(null);
  const reviewModeRef = useRef(reviewMode);
  useEffect(() => {
    reviewModeRef.current = reviewMode;
  }, [reviewMode]);

  useEffect(() => {
    setReplaceLine(null);
  }, [sourceFilename, projectId]);
  useEffect(() => {
    commentsListDetachedRef.current = commentsListDetached;
  }, [commentsListDetached]);

  const effectiveActiveLine =
    reviewMode && reviewFocusLine != null ? reviewFocusLine : activeAnnotatedLine;

  useEffect(() => {
    if (!reviewMode || reviewFocusLine == null) return;
    editorRef.current?.revealLineInCenter(reviewFocusLine);
  }, [reviewMode, reviewFocusLine]);

  const lineAnnotationMap = useMemo(
    () => buildLineAnnotationMap(annotations, commentLibrary),
    [annotations, commentLibrary],
  );

  const annotatedLines = useMemo(
    () => [...lineAnnotationMap.keys()].filter((ln) => Number.isFinite(ln) && ln >= 1).sort((a, b) => a - b),
    [lineAnnotationMap],
  );
  const annotatedLinesSetRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    annotatedLinesSetRef.current = new Set(annotatedLines);
  }, [annotatedLines]);

  const updateEditorMetrics = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setEditorMetrics({
      scrollTop: ed.getScrollTop(),
      viewportHeight: ed.getLayoutInfo().height,
      contentHeight: ed.getContentHeight(),
    });
  }, []);

  const updateEditorMetricsThrottled = useCallback(() => {
    if (metricsRafIdRef.current != null) return;
    metricsRafIdRef.current = window.requestAnimationFrame(() => {
      metricsRafIdRef.current = null;
      updateEditorMetrics();
    });
  }, [updateEditorMetrics]);

  useEffect(() => {
    const styleId = "checkmate-annotated-line-style";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = `
      .monaco-editor .${annotatedLineDecorationClassName} {
        background: ${colors.errorContainer} !important;
        border-radius: 4px;
      }
      .monaco-editor .${annotatedLineDecorationActiveClassName} {
        background: ${colors.errorContainer} !important;
        border-radius: 4px;
        outline: 2px solid ${colors.error} !important;
      }
      .monaco-editor .${annotatedLineDecorationHitClassName} {
        cursor: pointer !important;
      }
      .checkmate-annotations-rail {
        scrollbar-width: none;
        -ms-overflow-style: none;
        overscroll-behavior: contain;
      }
      .checkmate-annotations-rail::-webkit-scrollbar {
        display: none;
      }
    `;
  }, [colors.mode]);

  const updateAnnotatedLineDecorations = useCallback(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;

    const oldIds = annotatedLineDecorationIdsRef.current;
    const newDecorations: editor.IModelDeltaDecoration[] = annotatedLines.map((lineNum) => {
      const content = model.getLineContent(lineNum);
      let endIdx = -1;
      for (let i = content.length - 1; i >= 0; i--) {
        if (!/\s/.test(content[i])) {
          endIdx = i;
          break;
        }
      }

      const startCol = 1;
      const endCol =
        endIdx >= 0 ? endIdx + 2 : model.getLineMaxColumn(lineNum);

      const className =
        effectiveActiveLine != null && lineNum === effectiveActiveLine
          ? annotatedLineDecorationActiveClassName
          : annotatedLineDecorationClassName;

      return {
        range: new monaco.Range(lineNum, startCol, lineNum, endCol),
        options: {
          className,
          inlineClassName: annotatedLineDecorationHitClassName,
        },
      };
    });
    annotatedLineDecorationIdsRef.current = ed.deltaDecorations(oldIds, newDecorations);
  }, [
    annotatedLineDecorationActiveClassName,
    annotatedLineDecorationClassName,
    annotatedLineDecorationHitClassName,
    annotatedLines,
    effectiveActiveLine,
  ]);

  useEffect(() => {
    updateAnnotatedLineDecorations();
  }, [updateAnnotatedLineDecorations]);

  useEffect(() => {
    return () => {
      editorDisposablesRef.current.forEach((d) => d.dispose());
      editorDisposablesRef.current = [];
      if (metricsRafIdRef.current != null) {
        window.cancelAnimationFrame(metricsRafIdRef.current);
        metricsRafIdRef.current = null;
      }
    };
  }, []);

  const overlayLayout = useMemo(() => {
    const cardVerticalGap = 8;
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) {
      return {
        items: [] as Array<{
          lineNum: number;
          title: string;
          details: string;
          showDetails: boolean;
          isStaleLibraryRef?: boolean;
          top: number;
        }>,
        contentHeight: Math.max(editorMetrics.viewportHeight, 0),
      };
    }
    const lineCount = model.getLineCount();
    const positioned = [...lineAnnotationMap.entries()]
      .filter(
        ([lineNum, rc]) =>
          lineNum >= 1 && lineNum <= lineCount && String(rc.title).trim() !== "",
      )
      .map(([lineNum, rc]) => {
        const top = ed.getTopForLineNumber(lineNum) - editorMetrics.scrollTop;
        return {
          lineNum,
          title: rc.title,
          details: rc.details,
          showDetails: rc.showDetails,
          isStaleLibraryRef: rc.isStaleLibraryRef,
          top,
        };
      })
      .sort((a, b) => a.top - b.top);

    let prevBottom = Number.NEGATIVE_INFINITY;
    const stacked = positioned.map((item) => {
      const adjustedTop = Math.max(item.top, prevBottom + cardVerticalGap);
      const measuredHeight = cardHeightsRef.current.get(item.lineNum) ?? 84;
      prevBottom = adjustedTop + measuredHeight;
      return { ...item, top: adjustedTop };
    });

    const maxBottom = stacked.reduce((acc, item) => {
      const measuredHeight = cardHeightsRef.current.get(item.lineNum) ?? 84;
      return Math.max(acc, item.top + measuredHeight);
    }, 0);

    return {
      items: stacked,
      contentHeight: Math.max(
        editorMetrics.viewportHeight,
        maxBottom + 20 + ANNOTATION_RAIL_BOTTOM_SLACK,
      ),
    };
  }, [lineAnnotationMap, editorMetrics.scrollTop, editorMetrics.viewportHeight, cardHeightsVersion]);

  useEffect(() => {
    updateEditorMetrics();
  }, [code, lineAnnotationMap, updateEditorMetrics]);

  return (
    <Paper
      elevation={1}
      sx={{
        flexGrow: 1,
        overflow: "hidden",
        p: 0,
        minHeight: 200,
        position: "relative",
      }}
    >
      <Editor
        height="100%"
        defaultLanguage="python"
        language="python"
        beforeMount={(monaco) => {
          monacoRef.current = monaco;
          defineCheckmateCodeThemes(monaco, colors.surfaceContainerLow);
        }}
        key={monacoThemeName}
        theme={monacoThemeName}
        value={code || "No source code available."}
        onMount={(ed) => {
          editorRef.current = ed;
          updateAnnotatedLineDecorations();
          updateEditorMetrics();
          editorDisposablesRef.current.forEach((d) => d.dispose());
          editorDisposablesRef.current = [];
          editorDisposablesRef.current.push(
            ed.onMouseDown((e) => {
              if (reviewModeRef.current) return;
              const pos = (e.target as any)?.position;
              const lineNumber = typeof pos?.lineNumber === "number" ? pos.lineNumber : null;
              if (lineNumber == null) return;
              if (annotatedLinesSetRef.current.has(lineNumber)) {
                setActiveAnnotatedLine(lineNumber);
              } else {
                setActiveAnnotatedLine(null);
              }
            }),
          );
          editorDisposablesRef.current.push(
            ed.onDidScrollChange(() => {
              updateEditorMetricsThrottled();
              if (commentsListDetachedRef.current) {
                setCommentsListDetached(false);
              }
              const pane = commentsPaneRef.current;
              if (pane && pane.scrollTop !== 0) {
                pane.scrollTop = 0;
              }
            }),
          );
          editorDisposablesRef.current.push(
            ed.onDidLayoutChange(() => updateEditorMetricsThrottled()),
          );
          editorDisposablesRef.current.push(
            ed.onDidContentSizeChange(() => updateEditorMetricsThrottled()),
          );
        }}
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
      <div
        style={{
          position: "absolute",
          right: 14,
          top: 14,
          width: 360,
          maxWidth: "42%",
          height: `${Math.max(0, editorMetrics.viewportHeight)}px`,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <div
          ref={commentsPaneRef}
          className="checkmate-annotations-rail"
          onWheel={(e) => {
            e.stopPropagation();
          }}
          onScroll={(e) => {
            const nextTop = e.currentTarget.scrollTop;
            setCommentsListDetached(nextTop > 0);
          }}
          style={{
            position: "relative",
            height: "100%",
            overflowY: "scroll",
            WebkitOverflowScrolling: "touch",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              position: "relative",
              height: `${overlayLayout.contentHeight}px`,
            }}
          >
            {overlayLayout.items.map(({ lineNum, title, details, showDetails, isStaleLibraryRef, top }) => {
              const selected = effectiveActiveLine === lineNum;
              return (
              <div
                key={lineNum}
                ref={(el) => {
                  if (!el) return;
                  const nextHeight = el.getBoundingClientRect().height || el.offsetHeight || 0;
                  const prevHeight = cardHeightsRef.current.get(lineNum) ?? 0;
                  if (Math.abs(nextHeight - prevHeight) >= 1) {
                    cardHeightsRef.current.set(lineNum, nextHeight);
                    setCardHeightsVersion((v) => v + 1);
                  }
                }}
                style={{
                  position: "absolute",
                  left: ANNOTATION_RAIL_CARD_INSET.left,
                  right: ANNOTATION_RAIL_CARD_INSET.right,
                  top: `${top}px`,
                  pointerEvents: "auto",
                  zIndex: selected ? 3 : 1,
                  transform: selected ? `translateX(-${SELECTED_ANNOTATION_NUDGE_X}px)` : "none",
                  transition: "transform 0.16s cubic-bezier(0.33, 1, 0.68, 1)",
                }}
              >
                <InlineAnnotationCard
                  lineNum={lineNum}
                  title={title}
                  details={details}
                  showDetails={showDetails}
                  active={effectiveActiveLine === lineNum}
                  staleLibraryRef={Boolean(isStaleLibraryRef)}
                  replaceDisabled={Boolean(workspaceBusy)}
                  reviewMode={reviewMode}
                  onReplaceRequest={
                    isStaleLibraryRef && !reviewMode
                      ? () => {
                          setReplaceLine(lineNum);
                        }
                      : undefined
                  }
                  onSelect={() => {
                    setActiveAnnotatedLine(lineNum);
                    editorRef.current?.revealLineInCenter(lineNum);
                  }}
                />
              </div>
            );
            })}
          </div>
        </div>
      </div>
      <ReplaceStaleAnnotationDialog
        open={replaceLine != null}
        lineNum={replaceLine ?? 0}
        comments={commentLibrary}
        disabled={Boolean(workspaceBusy)}
        mode="stale"
        onClose={() => setReplaceLine(null)}
        onPick={async (commentId) => {
          if (replaceLine == null) return;
          const r = await addProjectAnnotation(projectId, {
            filename: sourceFilename,
            line: replaceLine,
            commentId,
          });
          if (!r.ok) {
            throw new Error(r.error || "Could not update annotation.");
          }
          setReplaceLine(null);
          onAnnotationsChanged?.();
        }}
      />
    </Paper>
  );
}
