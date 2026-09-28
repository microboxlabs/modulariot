/**
 * The `request_approval` card: a call the harness waits for the user to
 * approve. Shared by the relay, which builds the card from the harness's
 * `approval.requested` and `approval.resolved` events, and the card itself.
 */

export const REQUEST_APPROVAL_TOOL = "request_approval";

/** The harness tool that calls a tool of an MCP skill. */
const MCP_CALL_TOOL = "mcp_call";

export type RequestApprovalArgs = {
  runId: string;
  approvalId: string;
  /** The tool asking: the MCP tool for an `mcp_call`, else the harness tool. */
  tool: string;
  /** What the tool will be called with, redacted by the harness. */
  input: Record<string, unknown>;
  inputTruncated?: boolean;
};

export type ApprovalStatus = "approved" | "rejected" | "expired";

export type RequestApprovalResult = {
  status: ApprovalStatus;
  by?: string;
  at?: string;
  comment?: string;
};

/** Actions with their own title; any other tool is titled by its name. */
export const APPROVAL_ACTIONS = [
  "stories_create",
  "stories_add_version",
  "stories_set_current",
  "stories_link",
  "connections_create",
  "connections_test",
  "selectables_replace",
  "selectables_delete",
  "selectables_bind",
] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export function approvalActionOf(tool: string): ApprovalAction | null {
  return APPROVAL_ACTIONS.find((action) => action === tool) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The card's arguments from an `approval.requested` event's data. */
export function approvalArgsOf(
  runId: string,
  data: Record<string, unknown>
): RequestApprovalArgs | null {
  const approvalId = str(data.approval_id);
  const tool = str(data.tool);
  if (!approvalId || !tool) return null;
  const input = isRecord(data.input) ? data.input : {};
  const inner = tool === MCP_CALL_TOOL ? str(input.tool) : null;
  return {
    runId,
    approvalId,
    tool: inner ?? tool,
    input: inner ? (isRecord(input.arguments) ? input.arguments : {}) : input,
    ...(data.input_truncated === true ? { inputTruncated: true } : {}),
  };
}

/** The card's result from an `approval.resolved` event. */
export function approvalResultOf(
  data: Record<string, unknown>,
  at?: string
): RequestApprovalResult {
  const by = str(data.resolved_by);
  const comment = str(data.comment);
  return {
    status: data.decision === "approve" ? "approved" : "rejected",
    ...(by ? { by } : {}),
    ...(at ? { at } : {}),
    ...(comment ? { comment } : {}),
  };
}

/** The name the action is about: a story's title, a connection's name, a
 * list's key. */
export function approvalSubject(input: Record<string, unknown>): string | null {
  const version = isRecord(input.version) ? input.version : {};
  return (
    str(input.title) ??
    str(input.name) ??
    str(input.key) ??
    str(version.label) ??
    null
  );
}

const SECRET_KEY =
  /password|passwd|token(?!s)|secret|dsn|authorization|api[_-]?key|credential/i;

const REDACTED = "[redacted]";

/** The input's fields as they can be shown: no secret-looking key and no
 * value the harness redacted. */
export function visibleEntries(
  input: Record<string, unknown>
): [string, unknown][] {
  return Object.entries(input).filter(
    ([key, value]) =>
      !SECRET_KEY.test(key) && value !== REDACTED && value !== undefined
  );
}

/** A story version's text, when the input carries one. */
export function storyContentOf(input: Record<string, unknown>): string | null {
  const version = isRecord(input.version) ? input.version : null;
  return version && typeof version.content === "string"
    ? version.content
    : null;
}
