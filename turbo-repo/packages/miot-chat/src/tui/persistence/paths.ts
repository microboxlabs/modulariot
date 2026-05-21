import { homedir } from "node:os";
import { join } from "node:path";

export function defaultMiotChatHome(): string {
  return join(homedir(), ".miot-chat");
}

export function sessionsDir(home: string): string {
  return join(home, "sessions");
}

export function sessionFile(home: string, conversationId: string): string {
  return join(sessionsDir(home), `${conversationId}.json`);
}

export function historyFile(home: string): string {
  return join(home, "history");
}
