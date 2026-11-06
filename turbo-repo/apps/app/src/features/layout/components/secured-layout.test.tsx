import { act, render, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SecuredLayout from "./secured-layout";
import {
  useCallSession,
  type CallSession,
} from "@/features/symptoms/components/map-view/prototype/call-center/call-session";
import type { StartCallOptions } from "@/features/symptoms/components/map-view/prototype/call-center/telnyx-call";

const navigation = vi.hoisted(() => ({ kiosk: false }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useSearchParams: () =>
    new URLSearchParams(navigation.kiosk ? "kiosk=true" : ""),
}));
vi.mock("@/auth", () => ({
  auth: async () => ({
    user: { id: "operator-1", email: "operator@example.test" },
  }),
}));
vi.mock("@/features/i18n/i18n.service", () => ({
  getDictionary: async () => [vi.fn(), {}],
}));
vi.mock("../utils/utils", () => ({
  buildNavBarMessages: vi.fn(),
  isHarnessUiEnabled: () => false,
}));
vi.mock("@/features/branding/domain-branding.service", () => ({
  getDomainBranding: async () => null,
}));
vi.mock("@/features/common/providers/alfresco-api/ecm-config", () => ({
  isEcmConfigured: () => true,
}));
vi.mock("./secured-navbar/org-switcher/use-org-scopes", () => ({
  useOrgScopes: () => ({ activeOrg: { slug: "org-1" } }),
}));
vi.mock("@/features/sidebar/context/sidebar-context", () => ({
  SidebarProvider: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  RuntimeConfigProvider: ({ children }: Readonly<PropsWithChildren>) =>
    children,
}));
vi.mock("./layout-content", () => ({
  LayoutContent: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock("./secured-navbar/secured-navbar", () => ({
  SecuredNavbar: () => null,
}));
vi.mock("./secured-sidebar/secured-sidebar", () => ({
  SecuredSidebar: () => null,
}));
vi.mock("./footer-secured/footer-secured", () => ({ default: () => null }));
vi.mock("@/features/sse/components/sse-listener/sse-listener", () => ({
  default: () => null,
}));
vi.mock("@/features/settings-admin/team/no-organization-gate", () => ({
  NoOrganizationGate: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock(
  "@/features/symptoms/components/map-view/prototype/call-center/call-bar",
  () => ({ default: () => null })
);

let session: CallSession;
function Page() {
  session = useCallSession();
  return <p>case page</p>;
}

async function layout(children: ReactNode) {
  return SecuredLayout({ children, params: Promise.resolve({ lang: "es" }) });
}

beforeEach(() => {
  sessionStorage.clear();
  navigation.kiosk = false;
});

describe("secured call lifetime", () => {
  it("keeps browser audio and the engine when navigation changes kiosk mode or the page", async () => {
    const hangup = vi.fn();
    let options: StartCallOptions | undefined;
    const view = render(await layout(<Page />));
    act(() => {
      session.startTelnyx({
        key: "case-1:contact-1",
        contactName: "Synthetic contact",
        contactRole: "Dispatcher",
        method: "phone",
        destination: "+12025550101",
        token: vi.fn().mockResolvedValue({
          token: "not-persisted",
          callerNumber: "+12025550100",
        }),
        endCall: vi.fn().mockResolvedValue(undefined),
        dial: async (input) => {
          options = input;
          return { hangup };
        },
      });
    });
    await waitFor(() => expect(session.call?.dialReady).toBe(true));
    const id = session.call?.id;
    const audio = options?.remoteElement;
    navigation.kiosk = true;
    view.rerender(await layout(<Page />));
    expect(session.call?.id).toBe(id);
    expect(session.call?.status).toBe("live");
    expect(view.container.querySelector("audio")).toBe(audio);
    view.rerender(await layout(<p>another page</p>));
    expect(view.container.querySelector("audio")).toBe(audio);
    expect(hangup).not.toHaveBeenCalled();
    view.unmount();
    expect(hangup).toHaveBeenCalledOnce();
  });
});
