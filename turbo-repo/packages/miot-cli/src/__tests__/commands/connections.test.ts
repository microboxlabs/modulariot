import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerConnectionsCommand } from "../../commands/connections/index.js";

vi.mock("../../action-context.js", () => ({
  getActionContext: vi.fn(),
}));

import { getActionContext } from "../../action-context.js";

const mockGetActionContext = vi.mocked(getActionContext);

function createProgram(): Command {
  const program = new Command();
  program
    .name("miot")
    .option("--base-url <url>")
    .option("--token <token>")
    .option("--organization <id>")
    .option("--profile <name>")
    .option("--output <mode>");
  registerConnectionsCommand(program);
  program.exitOverride();
  return program;
}

describe("connections", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists integration connections", async () => {
    const mockConnections = [
      {
        id: "conn-1",
        name: "PostgREST",
        providerType: "POSTGREST",
        status: "ACTIVE",
      },
    ];
    const mockClient = {
      connections: { list: vi.fn().mockResolvedValue(mockConnections) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as never,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync(["node", "miot", "connections", "list"]);

    expect(mockClient.connections.list).toHaveBeenCalledWith();
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(mockConnections, null, 2),
    );
  });

  it("creates an integration connection with metadata", async () => {
    const mockConnection = { id: "conn-1", name: "Fleet API" };
    const mockClient = {
      connections: { create: vi.fn().mockResolvedValue(mockConnection) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as never,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "connections",
      "create",
      "--name",
      "Fleet API",
      "--provider",
      "POSTGREST",
      "--provider-base-url",
      "https://postgrest.example.com",
      "--credential-profile",
      "profile-1",
      "--metadata-json",
      '{"service":"fleet"}',
    ]);

    expect(mockClient.connections.create).toHaveBeenCalledWith({
      name: "Fleet API",
      providerType: "POSTGREST",
      baseUrl: "https://postgrest.example.com",
      credentialProfileId: "profile-1",
      metadata: { service: "fleet" },
    });
  });

  it("tests an integration connection", async () => {
    const mockResult = {
      success: true,
      testedAt: "2026-01-01T00:00:00Z",
      message: "ok",
    };
    const mockClient = {
      connections: { test: vi.fn().mockResolvedValue(mockResult) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as never,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "connections",
      "test",
      "conn-1",
      "--method",
      "GET",
      "--path",
      "/health",
    ]);

    expect(mockClient.connections.test).toHaveBeenCalledWith("conn-1", {
      method: "GET",
      path: "/health",
    });
  });

  it("creates a credential profile with config JSON", async () => {
    const mockProfile = { id: "profile-1", displayName: "Bearer" };
    const mockClient = {
      credentialProfiles: { create: vi.fn().mockResolvedValue(mockProfile) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as never,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "connections",
      "profiles",
      "create",
      "--display-name",
      "Bearer",
      "--auth-type",
      "BEARER_TOKEN",
      "--public-config-json",
      '{"header":"Authorization"}',
      "--secret-config-json",
      '{"token":"secret"}',
    ]);

    expect(mockClient.credentialProfiles.create).toHaveBeenCalledWith({
      displayName: "Bearer",
      authType: "BEARER_TOKEN",
      publicConfig: { header: "Authorization" },
      secretConfig: { token: "secret" },
    });
  });

  it("creates a connection operation", async () => {
    const mockOperation = { id: "op-1", name: "List trucks" };
    const mockClient = {
      connections: { createOperation: vi.fn().mockResolvedValue(mockOperation) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as never,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "connections",
      "operations",
      "create",
      "conn-1",
      "--name",
      "List trucks",
      "--method",
      "GET",
      "--path",
      "/trucks",
      "--response-schema-json",
      '{"type":"array"}',
      "--test-operation",
    ]);

    expect(mockClient.connections.createOperation).toHaveBeenCalledWith(
      "conn-1",
      {
        name: "List trucks",
        method: "GET",
        path: "/trucks",
        requestSchema: undefined,
        responseSchema: { type: "array" },
        testOperation: true,
      },
    );
  });
});
