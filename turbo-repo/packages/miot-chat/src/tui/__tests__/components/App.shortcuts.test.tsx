import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../../App.js";
import type { ResolvedConfig } from "../../../config.js";

const CTRL_R = "\x12";
const CTRL_T = "\x14";
const CTRL_G = "\x07";
const CTRL_Q = "\x11";

function mkConfig(): ResolvedConfig {
  return {
    baseUrl: "http://localhost:8000",
    token: null,
    tenantId: "demo-tenant",
    userId: "demo-user",
    mode: "auto",
    profileName: "test",
    theme: null,
    debug: false,
    orgSlug: null,
    harnessBaseUrl: "http://localhost:8000",
  };
}

function mkClient() {
  return {
    runs: {
      create: vi.fn(),
      stream: vi.fn(),
      get: vi.fn(),
    },
  };
}

async function tick(ms = 50): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("<App /> global shortcuts", () => {
  it("ctrl+r opens the resume picker", async () => {
    const { stdin, lastFrame } = render(
      <App config={mkConfig()} client={mkClient()} home="/tmp/miot-app-sc-r" />,
    );
    await tick();
    stdin.write(CTRL_R);
    await tick();
    expect(lastFrame() ?? "").toContain("resume session");
  });

  it("ctrl+t opens the theme picker", async () => {
    const { stdin, lastFrame } = render(
      <App config={mkConfig()} client={mkClient()} home="/tmp/miot-app-sc-t" />,
    );
    await tick();
    stdin.write(CTRL_T);
    await tick();
    expect(lastFrame() ?? "").toContain("↑↓ navigate · enter apply · esc cancel");
  });

  it("ctrl+g prints the help text", async () => {
    const { stdin, lastFrame } = render(
      <App config={mkConfig()} client={mkClient()} home="/tmp/miot-app-sc-g" />,
    );
    await tick();
    stdin.write(CTRL_G);
    await tick();
    expect(lastFrame() ?? "").toContain("available commands:");
  });

  it("ctrl+q exits via onExit", async () => {
    const onExit = vi.fn();
    const { stdin } = render(
      <App
        config={mkConfig()}
        client={mkClient()}
        home="/tmp/miot-app-sc-q"
        onExit={onExit}
      />,
    );
    await tick();
    stdin.write(CTRL_Q);
    await tick();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("shortcuts are inert while a modal is open", async () => {
    const onExit = vi.fn();
    const { stdin, lastFrame } = render(
      <App
        config={mkConfig()}
        client={mkClient()}
        home="/tmp/miot-app-sc-modal"
        onExit={onExit}
      />,
    );
    await tick();
    stdin.write(CTRL_T);
    await tick();
    expect(lastFrame() ?? "").toContain("↑↓ navigate · enter apply · esc cancel");
    // With the theme picker open, ctrl+q must not exit.
    stdin.write(CTRL_Q);
    await tick();
    expect(onExit).not.toHaveBeenCalled();
  });
});
