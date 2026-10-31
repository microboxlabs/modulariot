import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { ReactNode } from "react";
import type { IntegrationConnection } from "../integration-config.types";
const state = vi.hoisted(() => ({
  replace: vi.fn(),
  owner: false,
  slug: "demo-org",
  connections: [] as IntegrationConnection[],
  remove: vi.fn(),
  removeManaged: vi.fn(),
  refresh: vi.fn(),
  connect: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
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
    useOrgScopes: () => ({ activeOrg: { slug: state.slug, role: "OWNER" } }),
  })
);
vi.mock("../use-integration-config", () => ({
  useIntegrationConfig: () => ({
    templates: [],
    connections: state.connections,
    removeConnection: state.remove,
    credentials: [],
    isLoading: false,
    error: null,
    saving: false,
    refresh: state.refresh,
  }),
}));
vi.mock("@/features/common/components/settings-page-shell", () => ({
  default: ({
    children,
    actions,
  }: {
    children: ReactNode;
    actions: ReactNode;
  }) => (
    <>
      {actions}
      {children}
    </>
  ),
}));
vi.mock("@/features/common/components/section-menu", () => ({
  default: () => null,
}));
vi.mock("./connections-list", () => ({
  ConnectionsList: ({
    connections,
    onDelete,
  }: Readonly<{
    connections: IntegrationConnection[];
    onDelete: (connection: IntegrationConnection) => void;
  }>) =>
    connections.map((connection) => (
      <button key={connection.id} onClick={() => onDelete(connection)}>
        Delete {connection.name}
      </button>
    )),
}));
vi.mock("./connections-toolbar", () => ({ ConnectionsToolbar: () => null }));
vi.mock("./templates-list", () => ({ TemplatesList: () => null }));
vi.mock("./template-form-modal", () => ({ TemplateFormModal: () => null }));
vi.mock("./template-picker-modal", () => ({
  TemplatePickerModal: ({
    show,
    onSelectManagedBigQuery,
  }: {
    show: boolean;
    onSelectManagedBigQuery?: () => void;
  }) =>
    show && onSelectManagedBigQuery ? (
      <button onClick={onSelectManagedBigQuery}>Managed BigQuery</button>
    ) : null,
}));
vi.mock("@/features/settings-admin/platform/use-platform-membership", () => ({
  useIsPlatformOwner: () => ({ isPlatformOwner: state.owner }),
}));
vi.mock("@/features/settings-admin/platform/org-service-account", () => ({
  connectManagedBigQuery: state.connect,
}));
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "pending"),
    success: state.success,
    error: state.failure,
  },
}));
vi.mock("./connection-form-modal", () => ({ ConnectionFormModal: () => null }));
vi.mock("./integration-delete-dialog", () => ({
  IntegrationDeleteDialog: ({
    show,
    onConfirm,
  }: Readonly<{ show: boolean; onConfirm: () => void }>) =>
    show ? <button onClick={onConfirm}>Confirm deletion</button> : null,
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
  vi.clearAllMocks();
  state.owner = false;
  state.slug = "demo-org";
  state.connections = [];
  state.remove.mockResolvedValue(undefined);
  state.removeManaged.mockResolvedValue(undefined);
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

describe("managed BigQuery connection", () => {
  function openPicker(owner: boolean) {
    state.owner = owner;
    state.params = new URLSearchParams("section=connections");
    render(
      <IntegrationConfigPageContent
        dict={en.pages.integrationConnections}
        breadcrumbDict={{}}
        rootDict={en}
        lang="en"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /new connection/i }));
  }
  it("does not offer the managed option to organization owners", () => {
    openPicker(false);
    expect(screen.queryByText("Managed BigQuery")).not.toBeInTheDocument();
  });
  it.each([true, false])(
    "refreshes after creation and reports the test result (%s)",
    async (tested) => {
      let finish!: (value: { tested: boolean; testMessage: string }) => void;
      state.connect.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      openPicker(true);
      fireEvent.click(screen.getByText("Managed BigQuery"));
      expect(state.connect).toHaveBeenCalledWith("demo-org");
      expect(state.refresh).not.toHaveBeenCalled();
      finish({ tested, testMessage: "Synthetic test result" });
      await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
      const notification = tested ? state.success : state.failure;
      await waitFor(() => expect(notification).toHaveBeenCalledOnce());
      expect(tested ? state.failure : state.success).not.toHaveBeenCalled();
    }
  );
  it("shows a failed creation without refreshing an unchanged list", async () => {
    state.connect.mockRejectedValueOnce(new Error("Synthetic failure"));
    openPicker(true);
    fireEvent.click(screen.getByText("Managed BigQuery"));
    await waitFor(() =>
      expect(state.failure).toHaveBeenCalledWith("Synthetic failure", {
        id: "pending",
      })
    );
    expect(state.refresh).not.toHaveBeenCalled();
  });
});

vi.mock(
  "@/features/settings-admin/platform/org-geocoding-connection",
  async (original) => ({
    ...(await original<
      typeof import("@/features/settings-admin/platform/org-geocoding-connection")
    >()),
    removeManagedGeocoding: state.removeManaged,
  })
);

describe("managed geocoding deletion scope", () => {
  it.each(["_platform", "demo-org"])(
    "uses the matching deletion path in %s",
    async (slug) => {
      state.slug = slug;
      state.owner = true;
      state.params = new URLSearchParams("section=connections");
      state.connections = [
        {
          id: "synthetic-geo",
          name: "Synthetic geocoding",
          providerType: "GEOCODING",
          baseUrl: "https://api.example.test",
          credentialProfileId: "synthetic-credential",
          status: "ACTIVE",
          lastTestedAt: null,
          lastTestResult: null,
          templateId: null,
          metadata: {},
        },
      ];
      render(
        <IntegrationConfigPageContent
          dict={en.pages.integrationConnections}
          breadcrumbDict={{}}
          rootDict={en}
          lang="en"
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Delete Synthetic geocoding" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
      if (slug === "_platform") {
        await waitFor(() =>
          expect(state.remove).toHaveBeenCalledWith("synthetic-geo")
        );
        expect(state.removeManaged).not.toHaveBeenCalled();
      } else {
        await waitFor(() =>
          expect(state.removeManaged).toHaveBeenCalledWith(slug)
        );
        expect(state.remove).not.toHaveBeenCalled();
      }
    }
  );
});
