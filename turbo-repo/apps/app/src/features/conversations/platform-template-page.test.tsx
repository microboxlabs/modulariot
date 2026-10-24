import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate } from "./conversations-types";

const api = vi.hoisted(() => ({
  usePlatformTemplate: vi.fn(),
  usePlatformTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("./template-editor", () => ({
  TemplateEditor: ({
    template,
    takenKeys,
  }: {
    template: ConversationTemplate | null;
    takenKeys: string[];
  }) => (
    <div data-testid="editor">
      {template?.key ?? "creating"}|{takenKeys.join(",")}
    </div>
  ),
}));

import PlatformTemplatePage from "./platform-template-page";
import { NEW_TEMPLATE } from "./platform-templates-catalog";

const dict = es.pages.userSettings;

const STORED_NEW: ConversationTemplate = {
  id: "t1",
  key: "new",
  name: "New",
  baseText: "Hola",
  whatsapp: null,
  email: null,
  version: "0.1.0",
  usedBy: [],
};

describe("PlatformTemplatePage", () => {
  beforeEach(() => {
    api.usePlatformTemplate.mockReset();
    api.usePlatformTemplates.mockReset();
  });

  it("opens a stored template whose key is 'new' as that template", () => {
    api.usePlatformTemplate.mockReturnValue({ data: STORED_NEW });
    api.usePlatformTemplates.mockReturnValue({ data: undefined });
    render(<PlatformTemplatePage templateKey="new" dict={dict} lang="es" />);
    expect(api.usePlatformTemplate).toHaveBeenCalledWith("new");
    expect(api.usePlatformTemplates).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("editor").textContent).toBe("new|");
  });

  it("creates only once the taken keys have loaded", () => {
    api.usePlatformTemplate.mockReturnValue({ data: undefined });
    api.usePlatformTemplates.mockReturnValue({ data: undefined });
    const { rerender } = render(
      <PlatformTemplatePage templateKey={NEW_TEMPLATE} dict={dict} lang="es" />
    );
    expect(api.usePlatformTemplate).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId("editor")).toBeNull();

    api.usePlatformTemplates.mockReturnValue({ data: [STORED_NEW] });
    rerender(
      <PlatformTemplatePage templateKey={NEW_TEMPLATE} dict={dict} lang="es" />
    );
    expect(screen.getByTestId("editor").textContent).toBe("creating|new");
  });

  it("does not open the creation form when the taken keys fail to load", () => {
    api.usePlatformTemplate.mockReturnValue({ data: undefined });
    api.usePlatformTemplates.mockReturnValue({ error: new Error("boom") });
    render(
      <PlatformTemplatePage templateKey={NEW_TEMPLATE} dict={dict} lang="es" />
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByTestId("editor")).toBeNull();
  });
});
