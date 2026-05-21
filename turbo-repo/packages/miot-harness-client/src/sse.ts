export interface SSEFrame {
  id?: string;
  event?: string;
  data: string;
}

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<SSEFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let id: string | undefined;
  let event: string | undefined;
  let dataLines: string[] = [];
  let hasField = false;

  const emit = (): SSEFrame | null => {
    if (!hasField) return null;
    const frame: SSEFrame = { data: dataLines.join("\n") };
    if (id !== undefined) frame.id = id;
    if (event !== undefined) frame.event = event;
    id = undefined;
    event = undefined;
    dataLines = [];
    hasField = false;
    return frame;
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line === "") {
          const frame = emit();
          if (frame !== null) yield frame;
          continue;
        }

        if (line.startsWith(":")) continue;

        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let val = colon === -1 ? "" : line.slice(colon + 1);
        if (val.startsWith(" ")) val = val.slice(1);

        if (field === "id") {
          id = val;
          hasField = true;
        } else if (field === "event") {
          event = val;
          hasField = true;
        } else if (field === "data") {
          dataLines.push(val);
          hasField = true;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      let line = buffer;
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line === "") {
        const frame = emit();
        if (frame !== null) yield frame;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
