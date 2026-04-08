import type { PaletteMode } from "@mui/material";
import type { Monaco } from "@monaco-editor/react";

/** Registered theme ids for `monaco.editor.defineTheme` / `Editor` `theme` prop. */
export const CHECKMATE_CODE_THEME_IDS = {
  dark: "checkmate-code-dark",
  light: "checkmate-code-light",
} as const;

/**
 * Registers Check Mate editor themes (dark/light) with a shared editor background,
 * typically `surfaceContainerLow` from the app palette.
 */
export function defineCheckmateCodeThemes(monaco: Monaco, editorBackground: string): void {
  monaco.editor.defineTheme(CHECKMATE_CODE_THEME_IDS.dark, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": editorBackground,
    },
  });
  monaco.editor.defineTheme(CHECKMATE_CODE_THEME_IDS.light, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": editorBackground,
    },
  });
}

export function checkmateCodeThemeId(mode: PaletteMode): string {
  return mode === "dark" ? CHECKMATE_CODE_THEME_IDS.dark : CHECKMATE_CODE_THEME_IDS.light;
}
