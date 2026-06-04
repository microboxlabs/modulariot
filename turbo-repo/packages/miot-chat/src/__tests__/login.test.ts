import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerLoginCommand } from "../commands/login.js";

vi.mock("@microboxlabs/miot-auth/browser-oauth", () => ({
  browserLogin: vi.fn(),
}));

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    readConfig: vi.fn(),
    upsertProfile: vi.fn(),
  };
});

import { browserLogin } from "@microboxlabs/miot-auth/browser-oauth";
import { readConfig, upsertProfile } from "../config.js";

const mockBrowserLogin = vi.mocked(browserLogin);
const mockReadConfig = vi.mocked(readConfig);
const mockUpsertProfile = vi.mocked(upsertProfile);

const BASE_URL = "https://platform.example.com";

function createProgram(): Command {
  const program = new Command();
  program
    .name("miot-chat")
    .option("--base-url <url>", "Harness base URL")
    .option("--token <token>", "Auth bearer token")
    .option("--profile <name>", "Named profile");
  registerLoginCommand(program);
  program.exitOverride();
  return program;
}

describe("login command", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: ReturnType<typeof vi.spyOn<any, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: string | number | null | undefined) => {
        return undefined as never;
      });

    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    mockBrowserLogin.mockResolvedValue({
      accessToken: "tok-123",
      baseUrl: BASE_URL,
      organizationId: "acme",
    });

    mockReadConfig.mockReturnValue({
      defaultProfile: "platform",
      profiles: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls browserLogin without profile keys and persists the token", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot-chat",
      "--base-url",
      BASE_URL,
      "login",
      "--no-open",
    ]);

    // browserLogin should receive baseUrl and openBrowser, but NOT profile keys
    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: BASE_URL,
        openBrowser: false,
      }),
    );
    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.not.objectContaining({ profile: expect.anything() }),
    );

    // upsertProfile should receive the token and orgSlug under "platform",
    // and always set makeDefault: true so the profile becomes active
    expect(mockUpsertProfile).toHaveBeenCalledWith(
      "platform",
      expect.objectContaining({
        baseUrl: BASE_URL,
        token: "tok-123",
        orgSlug: "acme",
      }),
      expect.objectContaining({ makeDefault: true }),
    );

    // stderr should confirm the saved profile name
    const stderrCalls = stderrSpy.mock.calls
      .map((args) => String(args[0]))
      .join("");
    expect(stderrCalls).toContain("platform");

    // exit 0
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("uses the --profile flag as the profile name when provided", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot-chat",
      "--base-url",
      BASE_URL,
      "--profile",
      "my-profile",
      "login",
      "--no-open",
    ]);

    expect(mockUpsertProfile).toHaveBeenCalledWith(
      "my-profile",
      expect.objectContaining({ token: "tok-123" }),
      expect.objectContaining({ makeDefault: true }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("preserves tenantId, userId, and mode from an existing profile", async () => {
    mockReadConfig.mockReturnValue({
      defaultProfile: "platform",
      profiles: {
        platform: {
          baseUrl: BASE_URL,
          token: null,
          tenantId: "real-tenant",
          userId: "real-user",
          mode: "agentic",
        },
      },
    });

    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot-chat",
      "--base-url",
      BASE_URL,
      "login",
      "--no-open",
    ]);

    expect(mockUpsertProfile).toHaveBeenCalledWith(
      "platform",
      expect.objectContaining({
        tenantId: "real-tenant",
        userId: "real-user",
        mode: "agentic",
      }),
      expect.objectContaining({ makeDefault: true }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits with code 3 when base URL is missing", async () => {
    // Make process.exit throw so execution stops at the guard, matching real
    // CLI behaviour where exit terminates the process immediately.
    exitSpy.mockImplementation((code?: unknown) => {
      throw new Error(`process.exit(${code ?? "undefined"})`);
    });

    const program = createProgram();

    delete process.env["MIOT_CHAT_BASE_URL"];

    await expect(
      program.parseAsync(["node", "miot-chat", "login", "--no-open"]),
    ).rejects.toThrow("process.exit(3)");

    expect(mockBrowserLogin).not.toHaveBeenCalled();
  });

  it("exits with code 1 and writes the error when browserLogin rejects", async () => {
    mockBrowserLogin.mockRejectedValue(new Error("browser timed out"));
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot-chat",
      "--base-url",
      BASE_URL,
      "login",
      "--no-open",
    ]);

    const stderrCalls = stderrSpy.mock.calls
      .map((args) => String(args[0]))
      .join("");
    expect(stderrCalls).toContain("browser timed out");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("passes optional OAuth options to browserLogin when provided", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot-chat",
      "--base-url",
      BASE_URL,
      "login",
      "--client-id",
      "miot-chat-public",
      "--audience",
      "https://api.example.com",
      "--scope",
      "openid profile",
      "--no-open",
    ]);

    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "miot-chat-public",
        audience: "https://api.example.com",
        scope: "openid profile",
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
