import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

vi.mock("@microboxlabs/miot-chat", () => ({
  resolveConfig: vi.fn(),
  runMiotChat: vi.fn(),
}));

vi.mock("@microboxlabs/miot-harness-client", () => ({
  createMiotHarnessClient: vi.fn(),
}));

vi.mock("../../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config.js")>();
  return { ...actual, readDotfile: vi.fn() };
});

import { registerChatCommand } from "../../commands/chat/index.js";
import { resolveConfig, runMiotChat } from "@microboxlabs/miot-chat";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { readDotfile } from "../../config.js";

const mockResolveConfig = vi.mocked(resolveConfig);
const mockRunMiotChat = vi.mocked(runMiotChat);
const mockCreateClient = vi.mocked(createMiotHarnessClient);
const mockReadDotfile = vi.mocked(readDotfile);

const EMAIL = "oscar@vialabs.net";
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}
const JWT = makeJwt({ email: EMAIL, sub: "google-oauth2|123" });

function createProgram(): Command {
  const program = new Command();
  program
    .name("miot")
    .option("--base-url <url>")
    .option("--token <token>")
    .option("--organization <id>")
    .option("--profile <name>")
    .option("--output <mode>");
  registerChatCommand(program);
  program.exitOverride();
  return program;
}

describe("chat", () => {
  beforeEach(() => {
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    mockRunMiotChat.mockResolvedValue(0);
    // The front-door URL miot-chat would derive from baseUrl + orgSlug.
    mockResolveConfig.mockReturnValue({
      baseUrl: "http://localhost:8180",
      token: "tok",
      tenantId: "demo-tenant",
      userId: "demo-user",
      mode: "auto",
      profileName: "default",
      theme: null,
      debug: false,
      orgSlug: "mintral",
      harnessBaseUrl: "http://localhost:8180/api/v1/orgs/mintral/harness",
    });
    mockReadDotfile.mockReturnValue({
      defaultProfile: "default",
      profiles: {
        default: {
          baseUrl: "http://localhost:8180",
          token: JWT,
          organizationId: "mintral",
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes the harness client through config.harnessBaseUrl (front door), not baseUrl", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "miot", "chat"]);

    expect(mockCreateClient).toHaveBeenCalledWith({
      baseUrl: "http://localhost:8180/api/v1/orgs/mintral/harness",
      token: "tok",
    });
  });

  it("sources auth (baseUrl/token/org) from ~/.miotrc.json by default", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "miot", "chat"]);

    expect(mockResolveConfig).toHaveBeenCalledWith({
      flags: expect.objectContaining({
        baseUrl: "http://localhost:8180",
        token: JWT,
        org: "mintral",
      }),
    });
  });

  it("defaults tenant to the org and user to the JWT email", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "miot", "chat"]);

    expect(mockResolveConfig).toHaveBeenCalledWith({
      flags: expect.objectContaining({ tenant: "mintral", user: EMAIL }),
    });
  });

  it("lets explicit --tenant/--user win over the org/email defaults", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "chat",
      "--tenant",
      "custom-tenant",
      "--user",
      "alice",
    ]);

    expect(mockResolveConfig).toHaveBeenCalledWith({
      flags: expect.objectContaining({ tenant: "custom-tenant", user: "alice" }),
    });
  });

  it("lets --org override the saved organization", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "miot", "chat", "--org", "acme"]);

    expect(mockResolveConfig).toHaveBeenCalledWith({
      flags: expect.objectContaining({ org: "acme" }),
    });
  });

  it("honors the global --organization when --org is absent", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "--organization",
      "globex",
      "chat",
    ]);

    expect(mockResolveConfig).toHaveBeenCalledWith({
      flags: expect.objectContaining({ org: "globex" }),
    });
  });

  it("direct mode (--harness-base-url) skips miotrc and sends no org", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "chat",
      "--harness-base-url",
      "http://localhost:8000",
      "--harness-token",
      "direct-tok",
    ]);

    expect(mockResolveConfig).toHaveBeenCalledWith({
      flags: expect.objectContaining({
        baseUrl: "http://localhost:8000",
        token: "direct-tok",
      }),
    });
    const firstCall = mockResolveConfig.mock.calls[0]?.[0];
    expect(firstCall?.flags).not.toHaveProperty("org");
    expect(mockReadDotfile).not.toHaveBeenCalled();
  });

  it("direct mode pins the harness URL verbatim, ignoring any resolved org prefix", async () => {
    // resolveConfig still returns an org-prefixed harnessBaseUrl (e.g. from a
    // stale ~/.miot-chat/config.json); direct mode must override it.
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "chat",
      "--harness-base-url",
      "http://localhost:8000",
    ]);

    expect(mockCreateClient).toHaveBeenCalledWith({
      baseUrl: "http://localhost:8000",
      token: "tok",
    });
  });
});
