import { useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  CloseRounded,
  FileUploadOutlined,
  InsertDriveFileRounded,
} from "@mui/icons-material";
import { Box, IconButton, Stack, useTheme } from "@mui/material";
import Button, { type ButtonProps } from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { borderRadius, font, useAppColors } from "./MuiTheme";

type CommonProps = Omit<ButtonProps, "onChange" | "children"> & {
  accept?: string;
  /** Shown when no file is selected yet. */
  placeholder?: string;
};

/** One file; default when `multiple` is omitted or false. */
export type FileSelectButtonSingleProps = CommonProps & {
  multiple?: false;
  file?: File | null;
  onFileChange?: (file: File | null) => void;
};

/** Multiple files; set `multiple` to true. */
export type FileSelectButtonMultiProps = CommonProps & {
  multiple: true;
  files?: File[] | null;
  onFilesChange?: (files: File[]) => void;
};

export type FileSelectButtonProps =
  | FileSelectButtonSingleProps
  | FileSelectButtonMultiProps;

type InternalPick = CommonProps & {
  multiple?: boolean;
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  files?: File[] | null;
  onFilesChange?: (files: File[]) => void;
};

export default function FileSelectButton(props: FileSelectButtonProps) {
  const colors = useAppColors();
  const isMulti = props.multiple === true;

  const {
    accept,
    placeholder,
    disabled,
    fullWidth,
    sx,
    multiple: _multiple,
    file: controlledSingle,
    onFileChange,
    files: controlledMulti,
    onFilesChange,
    ...buttonProps
  } = props as InternalPick & Omit<ButtonProps, "onChange" | "children">;

  const inputRef = useRef<HTMLInputElement>(null);
  const [internalSingle, setInternalSingle] = useState<File | null>(null);
  const [internalMulti, setInternalMulti] = useState<File[]>([]);

  const isControlledSingle = !isMulti && controlledSingle !== undefined;
  const isControlledMulti = isMulti && controlledMulti !== undefined;

  const singleFile = isMulti
    ? null
    : isControlledSingle
      ? (controlledSingle ?? null)
      : internalSingle;

  const multiFiles = isMulti
    ? isControlledMulti
      ? (controlledMulti ?? [])
      : internalMulti
    : [];

  const displayFiles: File[] = isMulti ? multiFiles : singleFile ? [singleFile] : [];

  const commitSingle = (file: File | null) => {
    if (!isControlledSingle) setInternalSingle(file);
    onFileChange?.(file);
  };

  const commitMulti = (files: File[]) => {
    if (!isControlledMulti) setInternalMulti(files);
    onFilesChange?.(files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (isMulti) {
      commitMulti(list ? Array.from(list) : []);
    } else {
      commitSingle(list?.[0] ?? null);
    }
    e.target.value = "";
  };

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    el.value = "";
    el.click();
  };

  const clearSelection = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = "";
    if (isMulti) {
      commitMulti([]);
    } else {
      commitSingle(null);
    }
  };

  const hasSelection = displayFiles.length > 0;
  const defaultPlaceholder = isMulti ? "Choose files…" : "Choose a file…";
  const acceptedFilesText = props.accept ? props.accept.split(",").map((ext) => ext.trim()).join(" or ") : "Any file";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={isMulti}
        disabled={disabled}
        onChange={handleChange}
      />
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          gap: 0.5,
          width: fullWidth ? "100%" : "auto",
        }}
      >
        <Button
          type="button"
          variant="outlined"
          startIcon={hasSelection ? <InsertDriveFileRounded /> : <FileUploadOutlined />}
          color={hasSelection ? "success" : "primary"}
          disabled={disabled}
          onClick={openPicker}
          aria-label={
            hasSelection
              ? `Selected: ${displayFiles.map((f) => f.name).join(", ")}`
              : (placeholder ?? defaultPlaceholder)
          }
          sx={{
            borderStyle: "dashed",
            borderWidth: 1.5,
            height: "auto",
            minHeight: 40,
            minWidth: 0,
            flex: 1,
            p: 1,
            justifyContent: "flex-start",
            textAlign: "left",
            borderRadius: `${borderRadius.small}px`,
            ...(!hasSelection && {
              borderColor: colors.divider,
              color: colors.onSurfaceVariant,
            }),
            ...sx,
          }}
          {...buttonProps}
        >
          <Stack spacing={0.3} sx={{ width: "100%", minWidth: 0 }}>
            <Typography
              variant="body2"
              component="span"
              noWrap
              sx={{
                width: "100%",
                textAlign: "left",
              }}
            >
              {placeholder ?? defaultPlaceholder}
            </Typography>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontFamily: font.monospace }}
              >
                {hasSelection ? displayFiles.map((f) => f.name).join(", ") : acceptedFilesText}
            </Typography>
          </Stack>
        </Button>
        {hasSelection ? (
          <IconButton
            type="button"
            size="small"
            disabled={disabled}
            aria-label={isMulti ? "Remove selected files" : "Remove selected file"}
            onClick={clearSelection}
            sx={{ alignSelf: "center", flexShrink: 0 }}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
    </>
  );
}
