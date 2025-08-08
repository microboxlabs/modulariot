export type AccessLogExtras = Record<
  string,
  string | number | boolean | undefined
>;

// Generate a lightweight request id suitable for correlation when none is provided
export const generateRequestId = (): string =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// Format date similar to nginx combined log time local: 08/Aug/2025:13:46:51 +0000
export const formatAccessLogDate = (date: Date): string => {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}:${hours}:${minutes}:${seconds} +0000`;
};

export function formatAccessLogLine(params: {
  prefix: "IN" | "OUT";
  remoteAddr?: string;
  method: string;
  pathAndQuery: string;
  status: number;
  contentLength?: string | number;
  userAgent?: string;
  startedAt: Date;
  durationMs: number;
  requestId: string;
  protocol?: string;
  extras?: AccessLogExtras;
}): string {
  const {
    prefix,
    remoteAddr,
    method,
    pathAndQuery,
    status,
    contentLength,
    userAgent,
    startedAt,
    durationMs,
    requestId,
    protocol = "HTTP/1.1",
    extras = {},
  } = params;

  const extrasStr = Object.entries(extras)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

  const durationSec = (durationMs / 1000).toFixed(3);
  const remote = remoteAddr ?? "-";
  const length = contentLength ?? "-";
  const ua = userAgent ?? "-";
  const extrasSegment = extrasStr ? `${extrasStr} ` : "";

  return `${prefix} ${remote} - - [${formatAccessLogDate(
    startedAt,
  )}] "${method} ${pathAndQuery} ${protocol}" ${status} ${length} "-" "${ua}" ${extrasSegment}duration_ms=${durationMs} duration_s=${durationSec} request_id=${requestId}`;
}
