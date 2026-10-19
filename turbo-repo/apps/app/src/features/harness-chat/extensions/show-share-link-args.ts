export const SHOW_SHARE_LINK_TOOL = "show_share_link";

export type ShowShareLinkArgs = {
  url: string;
  targetType: string;
  targetId: string;
  title?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The MCP result in a harness `tool.completed` event's data, or null. */
function mcpResultOf(
  data: Record<string, unknown>
): { tool: string; result: Record<string, unknown> } | null {
  if (data.tool !== "mcp_call" || data.ok === false) return null;
  const preview = data.preview;
  if (!isRecord(preview) || typeof preview.tool !== "string") return null;
  if (!isRecord(preview.result)) return null;
  return { tool: preview.tool, result: preview.result };
}

function isShareUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.pathname.includes("/share/")
    );
  } catch {
    return false;
  }
}

/**
 * The link a completed `mcp_call` created, from a `*_link` tool's result.
 * Null when the event is anything else, or when the result has no absolute
 * `/share/` URL (the harness only builds one when it knows the app's URL).
 */
export function shareLinkOf(
  data: Record<string, unknown>,
  titles: ReadonlyMap<string, string> = new Map()
): ShowShareLinkArgs | null {
  const call = mcpResultOf(data);
  if (!call?.tool.endsWith("_link")) return null;
  const { url, targetType, targetId } = call.result;
  if (!isShareUrl(url)) return null;
  if (typeof targetType !== "string" || typeof targetId !== "string")
    return null;
  const title = titles.get(targetId);
  return { url, targetType, targetId, ...(title ? { title } : {}) };
}

/** Story titles, by id, that a completed `mcp_call` returned: one story
 * (create; get wraps it in `story`) or a list of them. */
export function storyTitlesOf(
  data: Record<string, unknown>
): [string, string][] {
  const call = mcpResultOf(data);
  if (!call) return [];
  const { result } = call;
  let stories: unknown[] = [result];
  if (Array.isArray(result.stories)) stories = result.stories;
  else if (isRecord(result.story)) stories = [result.story];
  return stories.flatMap((story: unknown) =>
    isRecord(story) &&
    typeof story.id === "string" &&
    typeof story.title === "string"
      ? [[story.id, story.title] as [string, string]]
      : []
  );
}
