import pino from "pino";
import { describe, expect, it } from "vitest";
import { SENSITIVE_LOG_PATHS } from "./logger-redaction";

describe("session log redaction", () => {
  it("removes session credentials from real debug output while preserving diagnostics", () => {
    const lines: string[] = [];
    const logger = pino(
      { level: "debug", redact: { paths: SENSITIVE_LOG_PATHS, remove: true } },
      { write: (line) => lines.push(line) }
    );
    logger.debug(
      {
        accessToken: "private-camel-access",
      refreshToken: "private-camel-refresh",
      idToken: "private-camel-id",
      session: { user: { accessToken: "private-session-access", refreshToken: "private-session-refresh", idToken: "private-session-id", rawJWT: "private-session-jwt" } },
      rawJWT: "private-jwt",
        access_token: "private-access",
        refresh_token: "private-refresh",
        id_token: "private-id",
        user: { rawJWT: "private-user-jwt", accessToken: "private-user-access", refreshToken: "private-user-refresh", idToken: "private-user-id", id: "viewer" },
        account: {
          access_token: "private-account-access",
          refresh_token: "private-account-refresh",
          id_token: "private-account-id",
          provider: "oidc",
        },
        req: {
          headers: {
            authorization: "private-header",
            cookie: "private-cookie",
          },
        },
        hasRawJWT: true,
      },
      "Session callback"
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("private-");
    expect(JSON.parse(lines[0]!)).toMatchObject({
      hasRawJWT: true,
      user: { id: "viewer" },
      account: { provider: "oidc" },
      msg: "Session callback",
    });
  });
});
