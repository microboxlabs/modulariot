import { decimalText, exactNumber } from "./condition-form";

/** When a case opens: as soon as the condition holds, or once it has held for some seconds. */
export type OpenWhen =
  | { kind: "instant" }
  | { kind: "sustained"; seconds: number };

/** When a case closes: minutes after it normalizes, when an operator closes it, or after some hours. */
export type CloseWhen =
  | { kind: "normal"; minutes: number }
  | { kind: "operator" }
  | { kind: "expire"; hours: number };

const OPEN = /^caso\.condicion_s\s*>=\s*(\S+)$/;
const NORMAL = /^caso\.normal_s\s*>=\s*(\S+)$/;
const EXPIRE = /^caso\.edad_h\s*>=\s*(\S+)$/;
const OPERATOR = /^caso\.cerrado_por_operador(\s*==\s*true)?$/;

/** The open rule as the form shows it, or null when it says something else. */
export function parseOpen(rule: string | null): OpenWhen | null {
  const m = OPEN.exec((rule ?? "").trim());
  const seconds = m ? exactNumber(m[1] ?? "") : null;
  if (seconds === null || seconds < 0) return null;
  return seconds === 0 ? { kind: "instant" } : { kind: "sustained", seconds };
}

export function compileOpen(open: OpenWhen): string {
  const seconds = open.kind === "instant" ? 0 : open.seconds;
  return `caso.condicion_s >= ${decimalText(seconds)}`;
}

/** The close rule as the form shows it, or null when it says something else. */
export function parseClose(rule: string | null): CloseWhen | null {
  const text = (rule ?? "").trim();
  if (OPERATOR.test(text)) return { kind: "operator" };
  const normal = NORMAL.exec(text);
  if (normal) {
    const seconds = exactNumber(normal[1] ?? "");
    if (seconds === null || seconds < 0) return null;
    const close: CloseWhen = { kind: "normal", minutes: seconds / 60 };
    // Only seconds that come back the same from minutes: 90 is 1.5 min, 7 is not a clean number of minutes.
    return compileClose(close) === `caso.normal_s >= ${decimalText(seconds)}`
      ? close
      : null;
  }
  const expire = EXPIRE.exec(text);
  const hours = expire ? exactNumber(expire[1] ?? "") : null;
  return hours === null || hours <= 0 ? null : { kind: "expire", hours };
}

export function compileClose(close: CloseWhen): string {
  if (close.kind === "operator") return "caso.cerrado_por_operador";
  if (close.kind === "expire")
    return `caso.edad_h >= ${decimalText(close.hours)}`;
  return `caso.normal_s >= ${decimalText(close.minutes * 60)}`;
}
