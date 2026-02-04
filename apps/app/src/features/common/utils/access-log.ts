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
    startedAt
  )}] "${method} ${pathAndQuery} ${protocol}" ${status} ${length} "-" "${ua}" ${extrasSegment}duration_ms=${durationMs} duration_s=${durationSec} request_id=${requestId}`;
}

export type AccessLogFields = {
  access: true;
  direction: "inbound" | "outbound";
  remote_addr?: string;
  http_method: string;
  http_target: string;
  http_status: number;
  bytes_sent?: number;
  http_user_agent?: string;
  http_protocol?: string;
  duration_ms: number;
  duration_s: number;
  request_id: string;
} & AccessLogExtras;

export function buildAccessLogFields(params: {
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
}): AccessLogFields {
  const {
    prefix,
    remoteAddr,
    method,
    pathAndQuery,
    status,
    contentLength,
    userAgent,
    durationMs,
    requestId,
    protocol = "HTTP/1.1",
    extras = {},
  } = params;

  const bytes =
    typeof contentLength === "number"
      ? contentLength
      : contentLength && /^[0-9]+$/.test(String(contentLength))
        ? Number(contentLength)
        : undefined;

  return {
    access: true,
    direction: prefix === "IN" ? "inbound" : "outbound",
    remote_addr: remoteAddr || undefined,
    http_method: method,
    http_target: pathAndQuery,
    http_status: status,
    bytes_sent: bytes,
    http_user_agent: userAgent || undefined,
    http_protocol: protocol,
    duration_ms: durationMs,
    duration_s: Number((durationMs / 1000).toFixed(3)),
    request_id: requestId,
    ...extras,
  };
}
