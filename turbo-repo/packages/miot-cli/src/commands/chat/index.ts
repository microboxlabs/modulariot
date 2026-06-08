import type { Command } from "commander";
import {
  resolveConfig,
  runAsk,
  runMiotChat,
  type CliFlags as MiotChatFlags,
  type ResolvedConfig,
} from "@microboxlabs/miot-chat";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { readDotfile } from "../../config.js";

/**
 * `miot chat` — talk to a harness, reusing the credentials saved by
 * `miot auth login` in ~/.miotrc.json.
 *
 *  - `miot chat` opens the Ink TUI (or the headless REPL on piped stdin /
 *    MIOT_CHAT_NO_TUI=1).
 *  - `miot chat ask "<message>"` sends one message, streams the answer, and
 *    exits — no TUI.
 *
 * Routing (shared by both):
 *  - Front-door (default): auth (baseUrl/token/org) comes from ~/.miotrc.json
 *    — the single source of truth for the `miot` commands. When an org is
 *    known, runs are routed through the quarkus front door at
 *    `{baseUrl}/api/v1/orgs/{org}/harness`. Org precedence: --org > global
 *    --organization > MIOT_ORGANIZATION_ID > the saved profile's
 *    organizationId. The run's tenant defaults to the org and the user to the
 *    login email (decoded from the JWT) so the header reflects the signed-in
 *    identity; --tenant/--user or MIOT_CHAT_* env still win, and the harness
 *    front door overrides the tenant server-side regardless.
 *  - Direct (--harness-base-url): point straight at a harness with no
 *    front-door prefix — handy for a local harness on :8000.
 */

interface RoutingOptions {
  // chat-level routing options
  org?: string;
  harnessBaseUrl?: string;
  harnessToken?: string;
  tenant?: string;
  user?: string;
  mode?: string;
  // merged in from the program globals via optsWithGlobals()
  baseUrl?: string;
  token?: string;
  organization?: string;
  profile?: string;
}

function applyRoutingOptions(command: Command): Command {
  return command
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
    .option("--tenant <id>", "Tenant ID (defaults to the org; or MIOT_CHAT_TENANT_ID env)")
    .option("--user <id>", "User ID (defaults to the login email; or MIOT_CHAT_USER_ID env)")
    .option(
      "--mode <mode>",
      "Dispatch mode: auto | canned | meta | agentic (or MIOT_CHAT_MODE env)",
    )
    .option(
      "--profile <name>",
      "Profile name (auth from ~/.miotrc.json, prefs from ~/.miot-chat/config.json)",
    );
}

/** Builds the resolved miot-chat config from the merged CLI options + env +
 *  ~/.miotrc.json, applying the front-door routing and tenant/user defaults. */
function resolveChatConfig(o: RoutingOptions): ResolvedConfig {
  let flags: MiotChatFlags;
  if (o.harnessBaseUrl) {
    // Direct mode: hit the harness URL as-is, no org/front-door prefix.
    flags = {
      baseUrl: o.harnessBaseUrl,
      ...(o.harnessToken !== undefined && { token: o.harnessToken }),
      ...(o.tenant !== undefined && { tenant: o.tenant }),
      ...(o.user !== undefined && { user: o.user }),
      ...(o.mode !== undefined && { mode: o.mode }),
      ...(o.profile !== undefined && { profile: o.profile }),
    };
  } else {
    // Front-door mode: auth from ~/.miotrc.json (single source of truth).
    const dotfile = readDotfile();
    const profileName = o.profile ?? dotfile?.defaultProfile;
    const profile = profileName ? dotfile?.profiles[profileName] : undefined;
    const baseUrl =
      o.baseUrl ?? process.env["MIOT_BASE_URL"] ?? profile?.baseUrl;
    const token = o.token ?? process.env["MIOT_TOKEN"] ?? profile?.token;
    const org =
      o.org ??
      o.organization ??
      process.env["MIOT_ORGANIZATION_ID"] ??
      profile?.organizationId;
    const tenant = o.tenant ?? process.env["MIOT_CHAT_TENANT_ID"] ?? org;
    const user =
      o.user ??
      process.env["MIOT_CHAT_USER_ID"] ??
      (token ? emailFromJwt(token) : undefined);

    flags = {
      ...(baseUrl !== undefined && { baseUrl }),
      ...(token !== undefined && { token }),
      ...(org !== undefined && { org }),
      ...(tenant !== undefined && { tenant }),
      ...(user !== undefined && { user }),
      ...(o.mode !== undefined && { mode: o.mode }),
      ...(o.profile !== undefined && { profile: o.profile }),
    };
  }

  const resolved = resolveConfig({ flags });
  // Direct mode pins the harness URL verbatim — never let an org slug from
  // ~/.miot-chat/config.json sneak a front-door prefix onto it.
  return o.harnessBaseUrl
    ? { ...resolved, harnessBaseUrl: o.harnessBaseUrl }
    : resolved;
}

export function registerChatCommand(program: Command): void {
  const chat = applyRoutingOptions(
    program
      .command("chat")
      .description(
        "Open the miot-chat TUI/REPL, reusing `miot auth login` credentials and routing through the org front door",
      ),
  ).action(async (_opts: unknown, cmd: Command) => {
    const config = resolveChatConfig(cmd.optsWithGlobals<RoutingOptions>());
    const client = createMiotHarnessClient({
      baseUrl: config.harnessBaseUrl,
      token: config.token,
    });
    const code = await runMiotChat({ config, client });
    process.exit(code);
  });

  applyRoutingOptions(
    chat
      .command("ask <message>")
      .description("Send one message, stream the answer, and exit (no TUI)")
      .option("--conversation <id>", "Override the conversation id for this run"),
  ).action(async (message: string, _opts: unknown, cmd: Command) => {
    const o = cmd.optsWithGlobals<RoutingOptions & { conversation?: string }>();
    const config = resolveChatConfig(o);
    const code = await runAsk({
      message,
      config,
      ...(o.conversation !== undefined && { conversationId: o.conversation }),
    });
    process.exit(code);
  });
}

/** Best-effort decode of the `email` claim from a JWT access token, for use
 *  as a display-only default user id. Returns undefined for non-JWT tokens
 *  (e.g. an Alfresco ticket) or when the claim is absent. No signature check —
 *  this is cosmetic, never an authorization decision. */
function emailFromJwt(token: string): string | undefined {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return undefined;
  try {
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { email?: unknown };
    return typeof claims.email === "string" && claims.email.length > 0
      ? claims.email
      : undefined;
  } catch {
    return undefined;
  }
}
