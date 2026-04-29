import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerAuthCommand } from "../../commands/auth/index.js";

vi.mock("../../auth/browser-oauth.js", () => ({
  browserLogin: vi.fn(),
}));

vi.mock("../../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config.js")>();
  return {
    ...actual,
    readDotfile: vi.fn(),
  };
});

import { browserLogin } from "../../auth/browser-oauth.js";
import { readDotfile } from "../../config.js";

const mockBrowserLogin = vi.mocked(browserLogin);
const mockReadDotfile = vi.mocked(readDotfile);

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
      profile: "staging",
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
        profile: "staging",
        openBrowser: false,
      }),
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
        profile: "staging",
        openBrowser: false,
      }),
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
