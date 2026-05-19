export const APPROVALS_UI_ENV = "MIOT_CHAT_APPROVALS_UI";

/**
 * The harness emits `approval.requested` events today but does NOT yet
 * expose an endpoint for the client to reply with the decision. The
 * approval UI ships behind a flag so users who want to *see* the prompts
 * can enable it; once the harness adds a reply endpoint, this flag will
 * default to "on".
 *
 * Pulls from process.env at call time so tests can flip it.
 */
export function isApprovalsUiEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[APPROVALS_UI_ENV];
  if (raw === undefined) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const APPROVAL_REPLY_PLACEHOLDER =
  "approval reply not yet supported by harness";
