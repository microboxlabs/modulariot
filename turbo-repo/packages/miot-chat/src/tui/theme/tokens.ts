// Color tokens consumed by the TUI components. Values must be acceptable
// to Ink's <Text color={...} /> prop: a named color (e.g. "yellow") or a
// 6-digit hex string ("#ff8800"). 8-color terminals will degrade hex to
// the nearest named color via chalk's internal mapping.

export interface ThemeTokens {
  accent: string;
  assistant: string;
  user: string;
  dim: string;
  warn: string;
  err: string;
  ok: string;
  border: string;
  prompt: string;
  spinner: string;
}
