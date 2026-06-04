import type { Command } from "commander";
import {
  getDotfilePath,
  readDotfile,
  removeProfile,
  resolveOutputMode,
  upsertProfile,
} from "../../config.js";
import { printDetail, printJson, printSuccess } from "../../output.js";
import { browserLogin } from "@microboxlabs/miot-auth/browser-oauth";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authenticate the CLI with ModularIoT");

  auth
    .command("login")
    .description("Log in through the browser using your platform session")
    .option("--login-url <url>", "Platform CLI login handoff endpoint")
    .option("--auth-url <url>", "OAuth authorization endpoint")
    .option("--token-url <url>", "OAuth token endpoint")
    .option("--client-id <id>", "OAuth public client ID")
    .option("--audience <audience>", "OAuth audience/API identifier")
    .option("--scope <scope>", "OAuth scopes to request")
    .option("--callback-host <host>", "Local callback host", "127.0.0.1")
    .option("--callback-port <port>", "Local callback port", (value) =>
      Number.parseInt(value, 10),
    )
    .option("--timeout <seconds>", "Login timeout in seconds", (value) =>
      Number.parseInt(value, 10),
    )
    .option("--no-open", "Print the login URL without opening the browser")
    .action(async (opts: LoginOptions, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        baseUrl?: string;
        organization?: string;
        profile?: string;
        output?: string;
      }>();
      const outputMode = resolveOutputMode(globals);
      const dotfile = readDotfile();
      const profileName = globals.profile ?? dotfile?.defaultProfile;
      const profile = profileName ? dotfile?.profiles[profileName] : undefined;
      const baseUrl =
        globals.baseUrl ?? process.env["MIOT_BASE_URL"] ?? profile?.baseUrl;

      if (!baseUrl) {
        console.error(
          "Error: missing base URL. Use --base-url, MIOT_BASE_URL, or ~/.miotrc.json.",
        );
        process.exit(3);
      }

      try {
        const result = await browserLogin({
          baseUrl,
          loginUrl: opts.loginUrl,
          authorizationUrl: opts.authUrl,
          tokenUrl: opts.tokenUrl,
          clientId: opts.clientId,
          audience: opts.audience,
          scope: opts.scope,
          organizationId: opts.clientId
            ? (globals.organization ?? profile?.organizationId)
            : undefined,
          callbackHost: opts.callbackHost,
          callbackPort: opts.callbackPort,
          timeoutSeconds: opts.timeout,
          openBrowser: opts.open,
        });

        const savedProfile = profileName ?? "default";
        upsertProfile(savedProfile, {
          baseUrl,
          token: result.accessToken,
          ...(result.organizationId !== undefined && {
            organizationId: result.organizationId,
          }),
        });

        const summary = {
          profile: savedProfile,
          baseUrl: result.baseUrl,
          ...(result.organizationId !== undefined && {
            organizationId: result.organizationId,
          }),
          ...(result.expiresIn !== undefined && { expiresIn: result.expiresIn }),
          ...(result.scope !== undefined && { scope: result.scope }),
        };

        if (outputMode === "json") {
          printJson(summary);
        } else {
          printSuccess(`Logged in. Saved credentials to ${getDotfilePath()}`);
          printDetail(summary);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (outputMode === "json") {
          printJson({ error: { message } });
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(1);
      }
    });

  auth
    .command("status")
    .description("Show the selected stored auth profile")
    .action((_opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ profile?: string; output?: string }>();
      const outputMode = resolveOutputMode(globals);
      const dotfile = readDotfile();
      const profileName = globals.profile ?? dotfile?.defaultProfile;
      const profile = profileName ? dotfile?.profiles[profileName] : undefined;

      if (!profileName || !profile) {
        console.error(`No stored auth profile found in ${getDotfilePath()}`);
        process.exit(1);
      }

      const status = {
        profile: profileName,
        baseUrl: profile.baseUrl,
        organizationId: profile.organizationId,
        token: maskToken(profile.token),
      };

      if (outputMode === "json") {
        printJson(status);
      } else {
        printDetail(status);
      }
    });

  auth
    .command("logout")
    .description("Remove the selected stored auth profile")
    .action((_opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ profile?: string; output?: string }>();
      const outputMode = resolveOutputMode(globals);
      const dotfile = readDotfile();
      const profileName = globals.profile ?? dotfile?.defaultProfile ?? "default";
      const removed = removeProfile(profileName);

      if (outputMode === "json") {
        printJson({ profile: profileName, removed });
      } else if (removed) {
        printSuccess(`Removed auth profile "${profileName}".`);
      } else {
        printSuccess(`No auth profile named "${profileName}" was stored.`);
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
  callbackHost?: string;
  callbackPort?: number;
  timeout?: number;
  open?: boolean;
}

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "********";
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
