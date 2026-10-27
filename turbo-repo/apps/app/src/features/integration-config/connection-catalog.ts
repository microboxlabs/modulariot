import { isBigQueryConnection } from "./bigquery-query";
import type { ComponentType, SVGProps } from "react";
import { Database, Image, Link } from "flowbite-react-icons/outline";
import { Whatsapp } from "flowbite-react-icons/solid";
import type {
  BrandLogoSources,
  LogoKeyline,
} from "@/features/common/components/brand-logo";
import { channelLogo } from "@/features/conversations/channel-icon";
import type {
  IntegrationConnection,
  IntegrationTemplate,
} from "./integration-config.types";

export interface ConnectionMark {
  readonly logo?: BrandLogoSources;
  readonly icon?: ComponentType<SVGProps<SVGSVGElement>>;
  readonly keyline?: LogoKeyline;
}

const PROVIDER_LABELS: Record<string, string> = {
  CAR_IMAGES: "CarImages",
  POSTGREST: "PostgREST",
  RESEND: "Resend",
  WHATSAPP: "WhatsApp",
};

const PROVIDER_MARKS: Record<string, ConnectionMark> = {
  CAR_IMAGES: { icon: Image },
  POSTGREST: { icon: Database },
  RESEND: {
    logo: {
      light: "/credential-logos/resend-light.svg",
      dark: "/credential-logos/resend-dark.svg",
    },
  },
  WHATSAPP: { icon: Whatsapp, keyline: "circle" },
};

/** The templates the communications channels create, by name (see ConnectionChannel in miot-conversational). */
const CHANNEL_TEMPLATES: Record<string, string> = {
  "Webhook de comunicaciones": "webhook",
  "Slack de comunicaciones": "slack",
  "Teams de comunicaciones": "teams",
};

export function providerLabel(providerType: string): string {
  return PROVIDER_LABELS[providerType] ?? providerType;
}

/** What a connection is an instance of: its template's name, or the built-in provider. */
export function connectionTypeName(
  connection: IntegrationConnection,
  templates: readonly IntegrationTemplate[]
): string {
  if (isBigQueryConnection(connection)) return "BigQuery";
  return (
    templates.find((template) => template.id === connection.templateId)?.name ??
    providerLabel(connection.providerType)
  );
}

export function connectionMark(
  connection: IntegrationConnection,
  typeName: string
): ConnectionMark {
  const channel = CHANNEL_TEMPLATES[typeName];
  if (channel) return { icon: channelLogo(channel) };
  if (isBigQueryConnection(connection)) {
    return { logo: { default: "/credential-logos/google-cloud.svg" } };
  }
  return PROVIDER_MARKS[connection.providerType] ?? { icon: Link };
}

export type ConnectionState = "active" | "failed" | "draft";

export function connectionState(
  connection: IntegrationConnection
): ConnectionState {
  if (connection.status === "ACTIVE" || connection.lastTestResult === true) {
    return "active";
  }
  if (
    connection.status === "TEST_FAILED" ||
    connection.lastTestResult === false
  ) {
    return "failed";
  }
  return "draft";
}

export interface ConnectionFilters {
  /** Free text matched against name, type and base URL. */
  readonly query: string;
  /** Selected type names; empty means "all". */
  readonly types: readonly string[];
  /** Selected states; empty means "all". */
  readonly states: readonly string[];
}

export type ConnectionSort = "NAME_ASC" | "NAME_DESC" | "TESTED_DESC";

export const DEFAULT_CONNECTION_FILTERS: ConnectionFilters = {
  query: "",
  types: [],
  states: [],
};

export const DEFAULT_CONNECTION_SORT: ConnectionSort = "NAME_ASC";

export function hasActiveConnectionFilters(filters: ConnectionFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.types.length > 0 ||
    filters.states.length > 0
  );
}

export function filterConnections(
  connections: readonly IntegrationConnection[],
  templates: readonly IntegrationTemplate[],
  filters: ConnectionFilters
): IntegrationConnection[] {
  const needle = filters.query.trim().toLowerCase();
  return connections.filter((connection) => {
    const type = connectionTypeName(connection, templates);
    if (
      needle &&
      ![connection.name, type, connection.baseUrl].some((field) =>
        field.toLowerCase().includes(needle)
      )
    ) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(type)) {
      return false;
    }
    return (
      filters.states.length === 0 ||
      filters.states.includes(connectionState(connection))
    );
  });
}

/** Returns a new array. Ties fall back to the name, and never-tested connections sort last. */
export function sortConnections(
  connections: readonly IntegrationConnection[],
  sort: ConnectionSort
): IntegrationConnection[] {
  const byName = (a: IntegrationConnection, b: IntegrationConnection) =>
    a.name.localeCompare(b.name);
  const tested = (c: IntegrationConnection) =>
    c.lastTestedAt ? new Date(c.lastTestedAt).getTime() : 0;
  const comparators: Record<
    ConnectionSort,
    (a: IntegrationConnection, b: IntegrationConnection) => number
  > = {
    NAME_ASC: byName,
    NAME_DESC: (a, b) => byName(b, a),
    TESTED_DESC: (a, b) => tested(b) - tested(a) || byName(a, b),
  };
  return [...connections].sort(comparators[sort]);
}
