import "server-only";
import crypto from "node:crypto";

interface CliAuthHandoff {
  token: string;
  organizationId: string;
  expiresAt: number;
}

const HANDOFF_TTL_MS = 5 * 60 * 1000;

// Anchor the store on globalThis so the login page (server component) and
// the token route handler share one Map even when the bundler compiles them
// into separate module graphs (Next dev/Turbopack) or HMR re-evaluates this
// module. Still single-process only — multi-instance deployments need a
// shared store (see PR #384 review).
const globalStore = globalThis as typeof globalThis & {
  __cliAuthHandoffs?: Map<string, CliAuthHandoff>;
};
globalStore.__cliAuthHandoffs ??= new Map<string, CliAuthHandoff>();
const handoffs = globalStore.__cliAuthHandoffs;

function pruneExpired(): void {
  const now = Date.now();
  for (const [code, handoff] of handoffs) {
    if (handoff.expiresAt <= now) {
      handoffs.delete(code);
    }
  }
}

export function createCliAuthHandoff(input: {
  token: string;
  organizationId: string;
}): { code: string; expiresIn: number } {
  pruneExpired();
  const code = crypto.randomBytes(32).toString("base64url");
  handoffs.set(code, {
    token: input.token,
    organizationId: input.organizationId,
    expiresAt: Date.now() + HANDOFF_TTL_MS,
  });
  return { code, expiresIn: Math.floor(HANDOFF_TTL_MS / 1000) };
}

export function consumeCliAuthHandoff(code: string): CliAuthHandoff | null {
  pruneExpired();
  const handoff = handoffs.get(code);
  if (!handoff) return null;
  handoffs.delete(code);
  return handoff;
}
