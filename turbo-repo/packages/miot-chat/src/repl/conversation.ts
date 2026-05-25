import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfigDir } from "../config.js";

const FILENAME = "last-conversation";

export function conversationFilePath(configDir?: string): string {
  return join(configDir ?? getConfigDir(), FILENAME);
}

export function readLastConversation(configDir?: string): string | null {
  const path = conversationFilePath(configDir);
  if (!existsSync(path)) return null;
  try {
    const value = readFileSync(path, "utf-8").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastConversation(
  conversationId: string,
  configDir?: string,
): void {
  const path = conversationFilePath(configDir);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${conversationId}\n`, { mode: 0o600 });
}
