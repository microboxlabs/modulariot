import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerAuthCommand } from "../../commands/auth/index.js";

vi.mock("@microboxlabs/miot-auth/browser-oauth", () => ({
  browserLogin: vi.fn(),
}));

vi.mock("../../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config.js")>();
  return {
    ...actual,
    readDotfile: vi.fn(),
    upsertProfile: vi.fn(),
  };
});

import { browserLogin } from "@microboxlabs/miot-auth/browser-oauth";
import { readDotfile, upsertProfile } from "../../config.js";

const mockBrowserLogin = vi.mocked(browserLogin);
const mockReadDotfile = vi.mocked(readDotfile);
const mockUpsertProfile = vi.mocked(upsertProfile);

function createProgram(): Command {
  const program = new Command();
  program
    .name("miot")
    .option("--base-url <url>")
    .option("--token <token>")
    .option("--organization <id>")
    .option("--profile <name>")
    .option("--output <mode>");
  registerAuthCommand(program);
  program.exitOverride();
  return program;
}

describe("auth", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockBrowserLogin.mockResolvedValue({
      accessToken: "new-token",
      baseUrl: "https://staging.example.com",
    });
    mockReadDotfile.mockReturnValue({
      defaultProfile: "staging",
      profiles: {
        staging: {
          baseUrl: "https://staging.example.com",
          token: "old-token",
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the selected dotfile profile base URL for browser login", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "--profile",
      "staging",
      "auth",
      "login",
      "--no-open",
    ]);

    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://staging.example.com",
        organizationId: undefined,
        openBrowser: false,
      }),
    );
    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.not.objectContaining({ profile: expect.anything() }),
    );
    expect(mockUpsertProfile).toHaveBeenCalledWith(
      "staging",
      expect.objectContaining({ token: "new-token" }),
    );
  });

  it("uses the default dotfile profile base URL for browser login", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "auth",
      "login",
      "--no-open",
    ]);

    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://staging.example.com",
        organizationId: undefined,
        openBrowser: false,
      }),
    );
  });

  it("persists the returned access token and prints a summary with the profile", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "--output",
      "json",
      "auth",
      "login",
      "--no-open",
    ]);

    expect(mockUpsertProfile).toHaveBeenCalledWith(
      "staging",
      expect.objectContaining({
        baseUrl: "https://staging.example.com",
        token: "new-token",
      }),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"profile": "staging"'),
    );
  });

  it("still supports explicit OAuth client login", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "miot",
      "auth",
      "login",
      "--client-id",
      "miot-cli",
      "--no-open",
    ]);

    expect(mockBrowserLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "miot-cli",
        organizationId: undefined,
      }),
    );
  });

  it("prints auth status for the default profile", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "miot", "auth", "status"]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("https://staging.example.com"),
    );
  });
});
