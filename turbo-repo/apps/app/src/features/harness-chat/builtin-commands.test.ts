import { describe, expect, it } from "vitest";
import { withBuiltinCommands } from "./builtin-commands";

const tr = (path: string) => path;

describe("withBuiltinCommands", () => {
  it("lists /compact and /context before the skills", () => {
    const menu = withBuiltinCommands(
      [{ id: "pending-deliveries", label: "Pending", description: "d" }],
      tr
    );
    expect(menu.map((item) => item.id)).toEqual([
      "compact",
      "context",
      "pending-deliveries",
    ]);
    expect(menu[0].label).toBe("compact");
  });

  it("drops a skill that uses a command's id", () => {
    const menu = withBuiltinCommands(
      [{ id: "context", label: "Skill", description: "d" }],
      tr
    );
    expect(menu.filter((item) => item.id === "context")).toHaveLength(1);
    expect(menu[1].label).toBe("context");
  });
});
