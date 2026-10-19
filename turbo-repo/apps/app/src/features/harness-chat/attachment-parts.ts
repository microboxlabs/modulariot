import type { Attachment } from "@microboxlabs/miot-harness-client";

type Part = Record<string, unknown>;

function isRecord(value: unknown): value is Part {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** `data:<mime>;base64,<body>` → its body; anything else is taken as base64. */
function base64Body(value: string): string {
  if (!value.startsWith("data:")) return value;
  const comma = value.indexOf(",");
  return comma === -1 ? "" : value.slice(comma + 1);
}

/**
 * The file an AG-UI user-message part carries inline, if it is one: an
 * `image` or `document` part with a data source, or the older `binary` part.
 * Parts that point at a URL are not files the harness can read.
 */
export function attachmentOfPart(part: unknown): Attachment | null {
  if (!isRecord(part)) return null;
  let mime: string | undefined;
  let data: string | undefined;
  if (part.type === "image" || part.type === "document") {
    const source = part.source;
    if (!isRecord(source) || source.type !== "data") return null;
    mime = str(source.mimeType);
    data = str(source.value);
  } else if (part.type === "binary") {
    mime = str(part.mimeType);
    data = str(part.data);
  } else {
    return null;
  }
  if (!mime || !data) return null;
  const metadata = isRecord(part.metadata) ? part.metadata : {};
  const name =
    str(metadata.filename) ?? str(part.filename) ?? defaultName(mime);
  const body = base64Body(data);
  return body ? { mime, name, data: body } : null;
}

function defaultName(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "document.pdf";
  return "file";
}

/** The line that stands in for a file once its bytes are gone, matching the
 * harness's own marker. */
export function attachmentMarker(attachment: Attachment): string {
  return `[${markerKind(attachment.mime)}: ${attachment.name ?? "file"}]`;
}

function markerKind(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "file";
}
