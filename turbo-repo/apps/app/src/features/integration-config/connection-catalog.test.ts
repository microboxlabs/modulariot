import { describe, expect, it } from "vitest";
import { Link } from "flowbite-react-icons/outline";
import { Whatsapp } from "flowbite-react-icons/solid";
import { FaSlack } from "react-icons/fa";
import {
  BIGQUERY_LOGO,
  POSTGREST_LOGO,
  connectionMark,
  connectionState,
  connectionTypeName,
  filterConnections,
  isPlatformManaged,
  sortConnections,
} from "./connection-catalog";
import type {
  IntegrationConnection,
  IntegrationTemplate,
} from "./integration-config.types";

const connection = (
  overrides: Partial<IntegrationConnection>
): IntegrationConnection => ({
  id: "c",
  name: "c",
  providerType: "CUSTOM_HTTP",
  baseUrl: "https://example.com",
  credentialProfileId: null,
  status: "DRAFT",
  lastTestedAt: null,
  lastTestResult: null,
  templateId: null,
  metadata: {},
  ...overrides,
});

const slackTemplate = {
  id: "t-slack",
  name: "Slack de comunicaciones",
} as IntegrationTemplate;

describe("connectionMark", () => {
  it("draws the provider's mark, the channel's for a channel template, and a link otherwise", () => {
    expect(
      connectionMark(connection({ providerType: "WHATSAPP" }), "WhatsApp")
    ).toEqual({
      icon: Whatsapp,
      keyline: "circle",
    });
    expect(
      connectionMark(connection({ providerType: "POSTGREST" }), "PostgREST")
        .logo
    ).toEqual(POSTGREST_LOGO);
    expect(
      connectionMark(
        connection({
          providerType: "CUSTOM_HTTP",
          baseUrl: "https://bigquery.googleapis.com",
          templateId: null,
        }),
        "BigQuery"
      ).logo
    ).toEqual(BIGQUERY_LOGO);
    expect(connectionMark(connection({}), "Slack de comunicaciones").icon).toBe(
      FaSlack
    );
    expect(connectionMark(connection({}), "Partner API").icon).toBe(Link);
  });
});

describe("connectionState", () => {
  it("is active when tested ok, failed when the test failed, draft otherwise", () => {
    expect(connectionState(connection({ lastTestResult: true }))).toBe(
      "active"
    );
    expect(connectionState(connection({ status: "TEST_FAILED" }))).toBe(
      "failed"
    );
    expect(connectionState(connection({}))).toBe("draft");
  });
});

describe("filterConnections and sortConnections", () => {
  const all = [
    connection({
      id: "1",
      name: "Slack ops",
      templateId: "t-slack",
      lastTestResult: true,
      lastTestedAt: "2026-10-01T00:00:00Z",
    }),
    connection({
      id: "2",
      name: "Datos",
      providerType: "POSTGREST",
      baseUrl: "https://pgrest.example.com",
    }),
  ];

  it("matches the text against the name, type and URL, and filters by type and state", () => {
    const filter = (f: Partial<Parameters<typeof filterConnections>[2]>) =>
      filterConnections(all, [slackTemplate], {
        query: "",
        types: [],
        states: [],
        ...f,
      }).map((c) => c.id);
    expect(filter({ query: "pgrest" })).toEqual(["2"]);
    expect(filter({ query: "slack de" })).toEqual(["1"]);
    expect(filter({ types: ["PostgREST"] })).toEqual(["2"]);
    expect(filter({ states: ["active"] })).toEqual(["1"]);
    expect(connectionTypeName(all[0], [slackTemplate])).toBe(
      "Slack de comunicaciones"
    );
  });

  it("sorts never-tested connections last", () => {
    expect(sortConnections(all, "TESTED_DESC").map((c) => c.id)).toEqual([
      "1",
      "2",
    ]);
    expect(sortConnections(all, "NAME_ASC").map((c) => c.id)).toEqual([
      "2",
      "1",
    ]);
  });
});

describe("isPlatformManaged", () => {
  it("marks the organization's geocoding connection, named Geocoding", () => {
    const geocoding = connection({ providerType: "GEOCODING" });

    expect(isPlatformManaged(geocoding)).toBe(true);
    expect(connectionTypeName(geocoding, [])).toBe("Geocoding");
    expect(isPlatformManaged(connection({}))).toBe(false);
  });
});
