export interface ColorOptions {
  noColor?: boolean;
  isTTY?: boolean;
}

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
export const CLEAR_LINE = `\r${ESC}K`;

export function useColor(opts: ColorOptions = {}): boolean {
  if (opts.noColor === true) return false;
  if (opts.isTTY === false) return false;
  return true;
}

export function dim(s: string, opts: ColorOptions = {}): string {
  return useColor(opts) ? `${ESC}2m${s}${RESET}` : s;
}

export function bold(s: string, opts: ColorOptions = {}): string {
  return useColor(opts) ? `${ESC}1m${s}${RESET}` : s;
}

export function red(s: string, opts: ColorOptions = {}): string {
  return useColor(opts) ? `${ESC}31m${s}${RESET}` : s;
}

export function yellow(s: string, opts: ColorOptions = {}): string {
  return useColor(opts) ? `${ESC}33m${s}${RESET}` : s;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[\d;?]*[a-zA-Z]/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "").replace(/\r/g, "");
}
