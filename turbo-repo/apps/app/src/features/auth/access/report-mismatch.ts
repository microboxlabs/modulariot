"use client";

import {
  describeRule,
  type AccessDecision,
  type AccessRule,
} from "./access-control";

const reported = new Set<string>();

/** Sends a shadow-mode mismatch to the server log, once per rule and context per page load. */
export function reportAccessMismatch(
  rule: AccessRule,
  decision: AccessDecision,
  context = ""
): void {
  const key = describeRule(rule);
  const id = `${key}@${context}`;
  if (reported.has(id)) return;
  reported.add(id);
  const body = JSON.stringify({
    key,
    context,
    byGroups: decision.byGroups,
    byPermissions: decision.byPermissions,
  });
  setTimeout(() => {
    fetch("/app/api/access/mismatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => reported.delete(id));
  }, 0);
}
