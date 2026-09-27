import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const create = vi.fn(async () => ({ run_id: "r1" }));

vi.mock("../../harness-context.js", () => ({
  getHarnessActionContext: () => ({
    client: { runs: { create } },
    outputMode: "json",
  }),
}));

import { registerHarnessCreateCommand } from "../../commands/harness/create.js";

function createProgram(): Command {
  const program = new Command();
  program.name("miot");
  const harness = program.command("harness");
  registerHarnessCreateCommand(harness);
  program.exitOverride();
  harness.exitOverride();
  return program;
}

describe("harness create", () => {
  beforeEach(() => {
    create.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends --model on the run request", async () => {
    await createProgram().parseAsync([
      "node",
      "miot",
      "harness",
      "create",
      "hi",
      "--tenant",
      "t1",
      "--model",
      "model-b",
    ]);
    expect(create).toHaveBeenCalledWith({
      message: "hi",
      tenant_id: "t1",
      model: "model-b",
    });
  });

  it("sends neither model nor mode when --model is omitted", async () => {
    await createProgram().parseAsync(["node", "miot", "harness", "create", "hi"]);
    expect(create).toHaveBeenCalledWith({ message: "hi" });
  });
});
