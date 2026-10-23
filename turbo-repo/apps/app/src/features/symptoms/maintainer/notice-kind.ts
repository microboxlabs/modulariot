import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import type { Notice } from "./maintainer-api";

/**
 * Provider types whose connections can send a level notice. Until integration
 * templates declare it themselves (#2002), this list decides.
 */
export const NOTICE_PROVIDERS = ["WHATSAPP", "RESEND", "CUSTOM_HTTP", "N8N"];

/** Kinds for notices stored with a channel before kinds. */
const CHANNEL_KINDS: Record<string, string> = {
  whatsapp: "WHATSAPP",
  email: "RESEND",
  teams: "CUSTOM_HTTP",
  webhook: "CUSTOM_HTTP",
};

/** The notice's provider type: its connection's, else the one it stores. */
export function noticeKind(
  notice: Notice,
  connections: readonly IntegrationConnection[] = []
): string | null {
  const connection = connections.find((c) => c.id === notice.connectionId);
  if (connection) return connection.providerType;
  if (notice.kind) return notice.kind;
  return notice.channel ? (CHANNEL_KINDS[notice.channel] ?? null) : null;
}

/** Connections that can send a notice, active ones first, then by name. */
export function noticeConnections(
  connections: readonly IntegrationConnection[]
): IntegrationConnection[] {
  return connections
    .filter((c) => NOTICE_PROVIDERS.includes(c.providerType))
    .sort(
      (a, b) =>
        Number(a.status === "INACTIVE") - Number(b.status === "INACTIVE") ||
        a.name.localeCompare(b.name)
    );
}

/** What the recipient field asks for, by provider type. */
export function recipientHint(kind: string | null): string {
  if (kind === "WHATSAPP") return "recipientPhone";
  if (kind === "RESEND") return "recipientEmail";
  return "recipientPlaceholder";
}
