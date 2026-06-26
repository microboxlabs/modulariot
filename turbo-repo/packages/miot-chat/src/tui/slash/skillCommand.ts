const DEFAULT_KICKOFF = "Let's get started.";

export interface SkillRun {
  skillId: string;
  message: string;
}

/**
 * Match a `/<skill-id> [args]` invocation against the known skill ids.
 * Returns the skill id + message (args, or a kickoff when none), or null
 * when the input isn't a slash command for a known skill (so the caller
 * falls through to normal slash-command dispatch).
 */
export function matchSkillRun(
  input: string,
  skillIds: ReadonlySet<string>,
): SkillRun | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const match = trimmed.match(/^\/(\S+)\s*([\s\S]*)$/);
  const token = match?.[1] ?? "";
  if (!skillIds.has(token)) return null;
  const args = (match?.[2] ?? "").trim();
  return { skillId: token, message: args.length > 0 ? args : DEFAULT_KICKOFF };
}
