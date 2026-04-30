import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ResolvedConfig {
  baseUrl: string;
  token: string;
  organizationId?: string;
}

interface DotfileProfile {
  baseUrl: string;
  token: string;
  organizationId?: string;
}

export interface Dotfile {
  defaultProfile?: string;
  profiles: Record<string, DotfileProfile>;
}

export function getDotfilePath(): string {
  return path.join(os.homedir(), ".miotrc.json");
}

export function readDotfile(): Dotfile | undefined {
  const filePath = getDotfilePath();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Dotfile;
  } catch {
    return undefined;
  }
}

export function writeDotfile(dotfile: Dotfile): void {
  const filePath = getDotfilePath();
  fs.writeFileSync(filePath, `${JSON.stringify(dotfile, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best-effort on filesystems that do not support POSIX modes.
  }
}

export function upsertProfile(
  profileName: string,
  profile: DotfileProfile,
): void {
  const dotfile = readDotfile() ?? { profiles: {} };
  dotfile.profiles[profileName] = profile;
  dotfile.defaultProfile ??= profileName;
  writeDotfile(dotfile);
}

export function removeProfile(profileName: string): boolean {
  const dotfile = readDotfile();
  if (!dotfile?.profiles[profileName]) {
    return false;
  }

  delete dotfile.profiles[profileName];
  if (dotfile.defaultProfile === profileName) {
    dotfile.defaultProfile = Object.keys(dotfile.profiles)[0];
  }
  writeDotfile(dotfile);
  return true;
}

export function resolveConfig(opts: {
  baseUrl?: string;
  token?: string;
  organization?: string;
  profile?: string;
}): ResolvedConfig {
  let baseUrl = opts.baseUrl ?? process.env["MIOT_BASE_URL"];
  let token = opts.token ?? process.env["MIOT_TOKEN"];
  let organizationId = opts.organization ?? process.env["MIOT_ORGANIZATION_ID"];

  if (!baseUrl || !token || !organizationId) {
    const dotfile = readDotfile();
    if (dotfile) {
      const profileName = opts.profile ?? dotfile.defaultProfile;
      const profile = profileName ? dotfile.profiles[profileName] : undefined;
      if (profile) {
        baseUrl ??= profile.baseUrl;
        token ??= profile.token;
        organizationId ??= profile.organizationId;
      }
    }
  }

  if (!baseUrl) {
    console.error(
      "Error: missing base URL. Use --base-url, MIOT_BASE_URL env, or ~/.miotrc.json",
    );
    process.exit(3);
  }

  if (!token) {
    console.error(
      "Error: missing token. Use --token, MIOT_TOKEN env, or ~/.miotrc.json",
    );
    process.exit(3);
  }

  return {
    baseUrl,
    token,
    ...(organizationId !== undefined && { organizationId }),
  };
}

export type OutputMode = "json" | "table";

export function resolveOutputMode(opts: { output?: string }): OutputMode {
  if (opts.output === "json" || opts.output === "table") {
    return opts.output;
  }
  return process.stdout.isTTY ? "table" : "json";
}
