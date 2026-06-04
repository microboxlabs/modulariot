import type { Command } from "commander";
import { browserLogin } from "@microboxlabs/miot-auth/browser-oauth";
import { readConfig, upsertProfile, type CliFlags } from "../config.js";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description(
      "Log in through the browser (platform session or Auth0 PKCE) and save the token to ~/.miot-chat/config.json",
    )
    .option("--login-url <url>", "Platform CLI login handoff endpoint")
    .option("--auth-url <url>", "OAuth authorization endpoint")
    .option("--token-url <url>", "OAuth token endpoint")
    .option("--client-id <id>", "OAuth public client ID")
    .option("--audience <audience>", "OAuth audience/API identifier")
    .option("--scope <scope>", "OAuth scopes to request")
    .option("--timeout <seconds>", "Login timeout in seconds", (v) =>
      Number.parseInt(v, 10),
    )
    .option("--no-open", "Print the login URL without opening the browser")
    .action(async (opts: LoginOptions) => {
      const flags = program.opts<CliFlags>();
      const baseUrl = flags.baseUrl ?? process.env["MIOT_CHAT_BASE_URL"];
      if (!baseUrl) {
        process.stderr.write(
          "error: missing base URL. Use --base-url or MIOT_CHAT_BASE_URL.\n",
        );
        process.exit(3);
      }
      try {
        const result = await browserLogin({
          baseUrl,
          ...(opts.loginUrl !== undefined && { loginUrl: opts.loginUrl }),
          ...(opts.authUrl !== undefined && { authorizationUrl: opts.authUrl }),
          ...(opts.tokenUrl !== undefined && { tokenUrl: opts.tokenUrl }),
          ...(opts.clientId !== undefined && { clientId: opts.clientId }),
          ...(opts.audience !== undefined && { audience: opts.audience }),
          ...(opts.scope !== undefined && { scope: opts.scope }),
          ...(opts.timeout !== undefined && { timeoutSeconds: opts.timeout }),
          openBrowser: opts.open,
        });
        const profileName = flags.profile ?? "platform";
        const existing = readConfig().profiles[profileName];
        upsertProfile(
          profileName,
          {
            baseUrl,
            token: result.accessToken,
            tenantId: existing?.tenantId ?? "demo-tenant",
            userId: existing?.userId ?? "demo-user",
            ...(existing?.mode !== undefined && { mode: existing.mode }),
            ...(result.organizationId !== undefined && {
              orgSlug: result.organizationId,
            }),
          },
          { makeDefault: true },
        );
        process.stderr.write(
          `Logged in. Saved profile "${profileName}" (org: ${result.organizationId ?? "n/a"}) and set it as default.\n`,
        );
        process.exit(0);
      } catch (err) {
        process.stderr.write(
          `error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(1);
      }
    });
}

interface LoginOptions {
  loginUrl?: string;
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  audience?: string;
  scope?: string;
  timeout?: number;
  open?: boolean;
}
