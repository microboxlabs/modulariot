import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(
    "section=bigquery&source=demo-old&query=demo-plan"
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
  usePathname: () => "/en/user/settings/connections",
  useSearchParams: () => state.params,
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({ activeOrg: { slug: "demo-org", role: "OWNER" } }),
  })
);
vi.mock("../use-integration-config", () => ({
  useIntegrationConfig: () => ({
    templates: [],
    connections: [],
    credentials: [],
    isLoading: false,
    error: null,
    saving: false,
  }),
}));
vi.mock("@/features/common/components/settings-page-shell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/common/components/section-menu", () => ({
  default: () => null,
}));
vi.mock("./connections-list", () => ({ ConnectionsList: () => null }));
vi.mock("./connections-toolbar", () => ({ ConnectionsToolbar: () => null }));
vi.mock("./templates-list", () => ({ TemplatesList: () => null }));
vi.mock("./template-form-modal", () => ({ TemplateFormModal: () => null }));
vi.mock("./template-picker-modal", () => ({ TemplatePickerModal: () => null }));
vi.mock("./connection-form-modal", () => ({ ConnectionFormModal: () => null }));
vi.mock("./integration-delete-dialog", () => ({
  IntegrationDeleteDialog: () => null,
}));
vi.mock("./postgrest-functions-modal", () => ({
  PostgrestFunctionsModal: () => null,
}));
vi.mock("./query-editor-section", () => ({
  QueryEditorSection: ({
    onSourceChange,
    onPlanChange,
  }: {
    onSourceChange: (value: string) => void;
    onPlanChange: (value: string | null, source?: string) => void;
  }) => (
    <>
      <button
        onClick={() => {
          onSourceChange("demo-new");
          onPlanChange(null, "demo-new");
        }}
      >
        Switch source
      </button>
      <button onClick={() => onPlanChange("demo-saved", "demo-default")}>
        Save default-source query
      </button>
    </>
  ),
}));
import { IntegrationConfigPageContent } from "./integration-config-page-content";
beforeEach(() => {
  state.replace.mockReset();
  state.params = new URLSearchParams(
    "section=bigquery&source=demo-old&query=demo-plan"
  );
});
describe("query authoring URL ownership", () => {
  it("keeps the newly selected source when the workbench then clears its query selection", () => {
    render(
      <IntegrationConfigPageContent
        dict={en.pages.integrationConnections}
        breadcrumbDict={{}}
        rootDict={en}
        lang="en"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch source" }));
    expect(state.replace).toHaveBeenLastCalledWith(
      "/en/user/settings/connections?section=bigquery&source=demo-new",
      { scroll: false }
    );
  });
  it("includes the actual source when saving from an implicit default source", () => {
    state.params = new URLSearchParams("section=bigquery");
    render(
      <IntegrationConfigPageContent
        dict={en.pages.integrationConnections}
        breadcrumbDict={{}}
        rootDict={en}
        lang="en"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save default-source query" })
    );
    expect(state.replace).toHaveBeenLastCalledWith(
      "/en/user/settings/connections?section=bigquery&source=demo-default&query=demo-saved",
      { scroll: false }
    );
  });
});
