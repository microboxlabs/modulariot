import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationTemplate: vi.fn(),
  useConversationTemplates: vi.fn(),
}));
vi.mock("./conversations-api", () => api);
const scope = vi.hoisted(() => ({ slug: "_platform", canMaintain: false }));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({ useOrgScopes: () => ({ activeOrg: { slug: scope.slug } }) })
);
vi.mock("@/features/common/platform-scope", () => ({
  isPlatformScope: (slug?: string) => slug === "_platform",
}));
vi.mock("@/features/symptoms/maintainer/maintainer-api", () => ({
  useControlTowerAccess: () => ({
    canMaintain: scope.canMaintain,
    loaded: true,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("./template-editor", () => ({
  TemplateEditor: ({
    template,
    takenKeys,
    readOnly,
    organization,
  }: {
    template: ConversationTemplate | null;
    takenKeys: string[];
    readOnly: boolean;
    organization: boolean;
  }) => (
    <div
      data-testid="editor"
      data-readonly={String(readOnly)}
      data-organization={String(organization)}
    >
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
    api.useConversationTemplate.mockReset();
    api.useConversationTemplates.mockReset();
    scope.slug = "_platform";
    scope.canMaintain = false;
  });

  it("in an organization opens its own template to edit and the platform's to read", () => {
    scope.slug = "mintral";
    scope.canMaintain = true;
    api.useConversationTemplates.mockReturnValue({ data: undefined });
    api.useConversationTemplate.mockReturnValue({
      data: { ...STORED_NEW, owner: "organization" },
    });
    const { rerender } = render(
      <PlatformTemplatePage templateKey="new" dict={dict} lang="es" />
    );
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.readonly).toBe("false");
    expect(editor.dataset.organization).toBe("true");

    api.useConversationTemplate.mockReturnValue({
      data: { ...STORED_NEW, owner: "platform" },
    });
    rerender(<PlatformTemplatePage templateKey="new" dict={dict} lang="es" />);
    expect(screen.getByTestId("editor").dataset.readonly).toBe("true");
  });

  it("opens a stored template whose key is 'new' as that template", () => {
    api.useConversationTemplate.mockReturnValue({ data: STORED_NEW });
    api.useConversationTemplates.mockReturnValue({ data: undefined });
    render(<PlatformTemplatePage templateKey="new" dict={dict} lang="es" />);
    expect(api.useConversationTemplate).toHaveBeenCalledWith("new");
    expect(api.useConversationTemplates).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("editor").textContent).toBe("new|");
  });

  it("creates only once the taken keys have loaded", () => {
    api.useConversationTemplate.mockReturnValue({ data: undefined });
    api.useConversationTemplates.mockReturnValue({ data: undefined });
    const { rerender } = render(
      <PlatformTemplatePage templateKey={NEW_TEMPLATE} dict={dict} lang="es" />
    );
    expect(api.useConversationTemplate).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId("editor")).toBeNull();

    api.useConversationTemplates.mockReturnValue({ data: [STORED_NEW] });
    rerender(
      <PlatformTemplatePage templateKey={NEW_TEMPLATE} dict={dict} lang="es" />
    );
    expect(screen.getByTestId("editor").textContent).toBe("creating|new");
  });

  it("does not open the creation form when the taken keys fail to load", () => {
    api.useConversationTemplate.mockReturnValue({ data: undefined });
    api.useConversationTemplates.mockReturnValue({ error: new Error("boom") });
    render(
      <PlatformTemplatePage templateKey={NEW_TEMPLATE} dict={dict} lang="es" />
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByTestId("editor")).toBeNull();
  });
});
