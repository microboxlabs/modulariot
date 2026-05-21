import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemePicker } from "../../modals/ThemePicker.js";
import { themeCommand } from "../../slash/handlers/theme.js";

describe("<ThemePicker />", () => {
  it("lists all builtin theme names", () => {
    const { lastFrame } = render(
      <ThemePicker onSelect={() => undefined} onCancel={() => undefined} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("dark");
    expect(frame).toContain("light");
    expect(frame).toContain("high-contrast");
  });

  it("Enter applies the first theme by default", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ThemePicker onSelect={onSelect} onCancel={() => undefined} />,
    );
    stdin.write("\r");
    await Promise.resolve();
    // builtinThemeNames returns sorted: ["dark","high-contrast","light"]
    expect(onSelect).toHaveBeenCalledWith("dark");
  });

  it("Arrow Down + Enter picks the second theme", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ThemePicker onSelect={onSelect} onCancel={() => undefined} />,
    );
    stdin.write("\x1b[B");
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("high-contrast");
  });

  it("preselects an initialName when provided", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <ThemePicker
        onSelect={onSelect}
        onCancel={() => undefined}
        initialName="light"
      />,
    );
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("light");
  });

  it("Esc calls onCancel", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <ThemePicker onSelect={() => undefined} onCancel={onCancel} />,
    );
    stdin.write("\x1b");
    await new Promise((r) => setTimeout(r, 50));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("/theme handler", () => {
  it("opens the picker with no preselect when called with no args", async () => {
    const r = await themeCommand.handle([], {});
    expect(r.modal).toEqual({ kind: "theme" });
  });

  it("passes the name as payload preselect", async () => {
    const r = await themeCommand.handle(["light"], {});
    expect(r.modal).toEqual({ kind: "theme", payload: { name: "light" } });
  });
});
