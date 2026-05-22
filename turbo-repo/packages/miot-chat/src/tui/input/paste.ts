export interface PasteState {
  inPaste: boolean;
  buffer: string;
}

export type PasteToken =
  | { kind: "text"; text: string }
  | { kind: "paste"; text: string };

export const PASTE_BEGIN = "\x1b[200~";
export const PASTE_END = "\x1b[201~";

export function initialPaste(): PasteState {
  return { inPaste: false, buffer: "" };
}

export function feedPaste(
  state: PasteState,
  chunk: string,
): { state: PasteState; tokens: PasteToken[] } {
  const tokens: PasteToken[] = [];
  let inPaste = state.inPaste;
  let buffer = state.buffer;
  let i = 0;
  let textStart = 0;

  while (i < chunk.length) {
    if (!inPaste) {
      if (chunk.startsWith(PASTE_BEGIN, i)) {
        if (i > textStart) {
          tokens.push({ kind: "text", text: chunk.slice(textStart, i) });
        }
        inPaste = true;
        i += PASTE_BEGIN.length;
        textStart = i;
        continue;
      }
      i += 1;
    } else {
      if (chunk.startsWith(PASTE_END, i)) {
        buffer += chunk.slice(textStart, i);
        tokens.push({ kind: "paste", text: buffer });
        buffer = "";
        inPaste = false;
        i += PASTE_END.length;
        textStart = i;
        continue;
      }
      i += 1;
    }
  }

  if (!inPaste) {
    if (textStart < chunk.length) {
      tokens.push({ kind: "text", text: chunk.slice(textStart) });
    }
  } else {
    buffer += chunk.slice(textStart);
  }

  return { state: { inPaste, buffer }, tokens };
}
