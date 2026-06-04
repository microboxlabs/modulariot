import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Read-only view of the miot-cli dotfile (~/.miotrc.json) written by
 * `miot auth login`. miot-chat never writes this file. organizationId
 * is the org slug used by /api/v1/orgs/{slug}/... paths. */
export interface MiotrcProfile {
  baseUrl: string;
  token: string;
  organizationId?: string;
}

interface Miotrc {
  defaultProfile?: string;
  profiles?: Record<string, Partial<MiotrcProfile>>;
}

export function readMiotrcProfile(opts?: {
  env?: NodeJS.ProcessEnv;
  profile?: string;
}): MiotrcProfile | null {
  const env = opts?.env ?? process.env;
  const home = (env.HOME ?? homedir()) || ".";
  try {
    const parsed = JSON.parse(
      readFileSync(join(home, ".miotrc.json"), "utf-8"),
    ) as Miotrc;
    const name = opts?.profile ?? parsed.defaultProfile;
    const profile = name ? parsed.profiles?.[name] : undefined;
    if (!profile?.baseUrl || !profile.token) return null;
    return {
      baseUrl: profile.baseUrl,
      token: profile.token,
      ...(typeof profile.organizationId === "string" && {
        organizationId: profile.organizationId,
      }),
    };
  } catch {
    return null;
  }
}
