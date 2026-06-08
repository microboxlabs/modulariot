import type { Command } from "commander";
import {
  resolveConfig,
  runMiotChat,
  type CliFlags as MiotChatFlags,
} from "@microboxlabs/miot-chat";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { readDotfile } from "../../config.js";

/**
 * `miot chat` — open the miot-chat TUI/REPL against a harness, reusing the
 * credentials saved by `miot auth login` in ~/.miotrc.json.
 *
 * Two modes:
 *  - Front-door (default): auth (baseUrl/token/org) comes from ~/.miotrc.json
 *    — the same single source of truth the rest of the `miot` commands use.
 *    When an org is known, runs are routed through the quarkus front door at
 *    `{baseUrl}/api/v1/orgs/{org}/harness` (miot-chat derives this as
 *    `config.harnessBaseUrl`). Org precedence: --org > global --organization >
 *    MIOT_ORGANIZATION_ID > the saved profile's organizationId.
 *  - Direct (--harness-base-url): point straight at a harness with no
 *    front-door prefix — handy for a local harness on :8000.
 *
 * Chat-specific prefs (tenant/user/mode/theme) still come from
 * ~/.miot-chat/config.json + MIOT_CHAT_* env + the flags below. In a TTY this
 * mounts the Ink TUI; on piped stdin (or MIOT_CHAT_NO_TUI=1) it falls back to
 * the headless line REPL.
 */
export function registerChatCommand(program: Command): void {
  program
    .command("chat")
    .description(
      "Open the miot-chat TUI/REPL, reusing `miot auth login` credentials and routing through the org front door",
    )
    .option(
      "--org <slug>",
      "Organization slug for front-door routing (overrides the saved login org and --organization)",
    )
    .option(
      "--harness-base-url <url>",
      "Talk to a harness directly at this URL (skips the org front door)",
    )
    .option(
      "--harness-token <token>",
      "Bearer token for direct --harness-base-url mode",
    )
    .option("--tenant <id>", "Tenant ID (or MIOT_CHAT_TENANT_ID env)")
    .option("--user <id>", "User ID (or MIOT_CHAT_USER_ID env)")
    .option(
      "--mode <mode>",
      "Dispatch mode: auto | canned | meta | agentic (or MIOT_CHAT_MODE env)",
    )
    .option(
      "--profile <name>",
      "Profile name (auth from ~/.miotrc.json, prefs from ~/.miot-chat/config.json)",
    )
    .action(async (opts: ChatOptions, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        baseUrl?: string;
        token?: string;
        organization?: string;
        profile?: string;
      }>();

      let flags: MiotChatFlags;
      if (opts.harnessBaseUrl) {
        // Direct mode: hit the harness URL as-is, no org/front-door prefix.
        flags = {
          baseUrl: opts.harnessBaseUrl,
          ...(opts.harnessToken !== undefined && { token: opts.harnessToken }),
          ...(opts.tenant !== undefined && { tenant: opts.tenant }),
          ...(opts.user !== undefined && { user: opts.user }),
          ...(opts.mode !== undefined && { mode: opts.mode }),
          ...(globals.profile !== undefined && { profile: globals.profile }),
        };
      } else {
        // Front-door mode: auth from ~/.miotrc.json (single source of truth).
        const dotfile = readDotfile();
        const profileName = globals.profile ?? dotfile?.defaultProfile;
        const profile = profileName
          ? dotfile?.profiles[profileName]
          : undefined;
        const baseUrl =
          globals.baseUrl ?? process.env["MIOT_BASE_URL"] ?? profile?.baseUrl;
        const token =
          globals.token ?? process.env["MIOT_TOKEN"] ?? profile?.token;
        const org =
          opts.org ??
          globals.organization ??
          process.env["MIOT_ORGANIZATION_ID"] ??
          profile?.organizationId;

        flags = {
          ...(baseUrl !== undefined && { baseUrl }),
          ...(token !== undefined && { token }),
          ...(org !== undefined && { org }),
          ...(opts.tenant !== undefined && { tenant: opts.tenant }),
          ...(opts.user !== undefined && { user: opts.user }),
          ...(opts.mode !== undefined && { mode: opts.mode }),
          ...(globals.profile !== undefined && { profile: globals.profile }),
        };
      }

      const resolved = resolveConfig({ flags });
      // Direct mode pins the harness URL verbatim — never let an org slug from
      // ~/.miot-chat/config.json sneak a front-door prefix onto it.
      const config = opts.harnessBaseUrl
        ? { ...resolved, harnessBaseUrl: opts.harnessBaseUrl }
        : resolved;
      const client = createMiotHarnessClient({
        baseUrl: config.harnessBaseUrl,
        token: config.token,
      });
      const code = await runMiotChat({ config, client });
      process.exit(code);
    });
}

interface ChatOptions {
  org?: string;
  harnessBaseUrl?: string;
  harnessToken?: string;
  tenant?: string;
  user?: string;
  mode?: string;
  profile?: string;
}
