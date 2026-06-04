import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { RunMode } from "@microboxlabs/miot-harness-client";
import { readMiotrcProfile } from "./miotrc.js";

export interface MiotChatProfile {
  baseUrl: string;
  token: string | null;
  tenantId: string;
  userId: string;
  mode?: RunMode;
  /**
   * Organization slug; when set, runs route through the quarkus-srv harness
   * proxy at {baseUrl}/api/v1/orgs/{orgSlug}/harness.
   */
  orgSlug?: string;
}

// Theme value persisted in config.json. The TUI's loadUserTheme() in
// src/tui/theme/loadUserTheme.ts is the runtime resolver; this is just
// the storage shape.
export type ThemeConfig =
  | string
  | { name?: string; tokens?: Record<string, string> };

export interface MiotChatConfig {
  defaultProfile: string;
  profiles: Record<string, MiotChatProfile>;
  theme?: ThemeConfig;
}

export interface ResolvedConfig {
  baseUrl: string;
  token: string | null;
  tenantId: string;
  userId: string;
  mode: RunMode;
  profileName: string;
  theme: ThemeConfig | null;
  /**
   * When true, outgoing runs request debug=true so the SSE stream
   * carries full tool inputs and truncated tool outputs. Requires
   * the server-side allow-list to permit the tenant.
   */
  debug: boolean;
  /** Org slug resolved from flag > env > profile, or null when not set. */
  orgSlug: string | null;
  /**
   * Effective base URL for the harness client — the quarkus proxy prefix
   * ({baseUrl}/api/v1/orgs/{orgSlug}/harness) when orgSlug is set,
   * otherwise baseUrl unchanged.
   */
  harnessBaseUrl: string;
}

export interface CliFlags {
  baseUrl?: string;
  token?: string;
  tenant?: string;
  user?: string;
  mode?: string;
  profile?: string;
  debug?: boolean;
  org?: string;
}

export interface ResolveOptions {
  flags?: CliFlags;
  env?: NodeJS.ProcessEnv;
  configDir?: string;
}

const VALID_MODES = new Set<RunMode>(["auto", "canned", "meta", "agentic"]);

export const DEFAULT_CONFIG: MiotChatConfig = {
  defaultProfile: "local",
  profiles: {
    local: {
      baseUrl: "http://localhost:8000",
      token: null,
      tenantId: "demo-tenant",
      userId: "demo-user",
    },
  },
};

export function getConfigDir(env?: NodeJS.ProcessEnv): string {
  const home = (env?.HOME ?? homedir()) || ".";
  return join(home, ".miot-chat");
}

export function getConfigPath(env?: NodeJS.ProcessEnv): string {
  return join(getConfigDir(env), "config.json");
}

export function readConfig(opts?: { configDir?: string }): MiotChatConfig {
  const dir = opts?.configDir ?? getConfigDir();
  const path = join(dir, "config.json");
  if (!existsSync(path)) return cloneDefault();
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MiotChatConfig>;
    return normalize(parsed);
  } catch {
    return cloneDefault();
  }
}

export function writeConfig(
  cfg: MiotChatConfig,
  opts?: { configDir?: string },
): void {
  const dir = opts?.configDir ?? getConfigDir();
  const path = join(dir, "config.json");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function resolveConfig(opts: ResolveOptions = {}): ResolvedConfig {
  const env = opts.env ?? process.env;
  const flags = opts.flags ?? {};
  const cfg = readConfig({ configDir: opts.configDir ?? getConfigDir(env) });

  const profileName =
    flags.profile ??
    env.MIOT_CHAT_PROFILE ??
    cfg.defaultProfile ??
    "local";
  const profile =
    cfg.profiles[profileName] ?? cfg.profiles[cfg.defaultProfile] ?? DEFAULT_CONFIG.profiles["local"]!;

  const tokenFlag = flags.token ?? env.MIOT_CHAT_TOKEN;
  // Platform fallback: reuse the miot-cli login session (~/.miotrc.json)
  // only when neither flags/env nor the chat profile carry a token.
  const platform =
    tokenFlag === undefined && (profile.token ?? null) === null
      ? readMiotrcProfile({ env })
      : null;

  const baseUrl =
    flags.baseUrl ??
    env.MIOT_CHAT_BASE_URL ??
    (platform ? platform.baseUrl : profile.baseUrl);
  const token = tokenFlag ?? profile.token ?? platform?.token ?? null;
  const tenantId =
    flags.tenant ?? env.MIOT_CHAT_TENANT_ID ?? profile.tenantId;
  const userId = flags.user ?? env.MIOT_CHAT_USER_ID ?? profile.userId;
  const modeRaw = flags.mode ?? env.MIOT_CHAT_MODE ?? profile.mode ?? "auto";
  const mode = (
    VALID_MODES.has(modeRaw as RunMode) ? modeRaw : "auto"
  ) as RunMode;

  const debug = Boolean(
    flags.debug ?? (env.MIOT_CHAT_DEBUG ? env.MIOT_CHAT_DEBUG !== "0" : false),
  );

  const orgSlug =
    nonEmpty(flags.org) ??
    nonEmpty(env.MIOT_CHAT_ORG) ??
    nonEmpty(profile.orgSlug) ??
    nonEmpty(platform?.organizationId) ??
    null;
  const harnessBaseUrl = orgSlug
    ? `${trimTrailingSlashes(baseUrl)}/api/v1/orgs/${encodeURIComponent(orgSlug)}/harness`
    : baseUrl;

  return {
    baseUrl,
    token,
    tenantId,
    userId,
    mode,
    profileName,
    theme: cfg.theme ?? null,
    debug,
    orgSlug,
    harnessBaseUrl,
  };
}

/** Returns the value unchanged if non-empty, otherwise undefined.
 * Treats empty strings as unset so `MIOT_CHAT_ORG=""` or `--org ""`
 * falls through to the next source in the resolution chain. */
function nonEmpty(v: string | undefined): string | undefined {
  return v === undefined || v === "" ? undefined : v;
}

function cloneDefault(): MiotChatConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as MiotChatConfig;
}

function trimTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 0x2f /* '/' */) end--;
  return end === s.length ? s : s.slice(0, end);
}

function normalize(parsed: Partial<MiotChatConfig>): MiotChatConfig {
  const profiles: Record<string, MiotChatProfile> = {};
  const sourceProfiles = parsed.profiles ?? {};
  for (const [name, p] of Object.entries(sourceProfiles)) {
    profiles[name] = {
      baseUrl: p.baseUrl ?? "http://localhost:8000",
      token: p.token ?? null,
      tenantId: p.tenantId ?? "demo-tenant",
      userId: p.userId ?? "demo-user",
      mode: VALID_MODES.has(p.mode as RunMode)
        ? (p.mode as RunMode)
        : undefined,
      ...(typeof p.orgSlug === "string" && p.orgSlug !== ""
        ? { orgSlug: p.orgSlug }
        : undefined),
    };
  }
  if (Object.keys(profiles).length === 0) {
    profiles.local = { ...DEFAULT_CONFIG.profiles.local! };
  }
  return {
    defaultProfile:
      parsed.defaultProfile && profiles[parsed.defaultProfile]
        ? parsed.defaultProfile
        : Object.keys(profiles)[0]!,
    profiles,
    theme: normalizeTheme(parsed.theme),
  };
}

// "Loose" view of a theme field as it arrives from JSON.parse. The
// declared MiotChatConfig.theme is ThemeConfig, but hand-edited
// config.json can put anything in there — tokens may not be strings,
// name may be a number, etc. ParsedTheme documents the boundary so
// the function signature isn't a blanket `unknown`.
type ParsedTheme =
  | string
  | { name?: unknown; tokens?: unknown }
  | null;

function normalizeTheme(
  theme: ParsedTheme | undefined,
): ThemeConfig | undefined {
  if (theme === undefined || theme === null) return undefined;
  if (typeof theme === "string") return theme;
  if (typeof theme === "object") {
    const out: { name?: string; tokens?: Record<string, string> } = {};
    if (typeof theme.name === "string") out.name = theme.name;
    if (theme.tokens && typeof theme.tokens === "object") {
      const tokens: Record<string, string> = {};
      for (const [k, v] of Object.entries(
        theme.tokens as Record<string, unknown>,
      )) {
        if (typeof v === "string") tokens[k] = v;
      }
      if (Object.keys(tokens).length > 0) out.tokens = tokens;
    }
    return out.name || out.tokens ? out : undefined;
  }
  return undefined;
}
