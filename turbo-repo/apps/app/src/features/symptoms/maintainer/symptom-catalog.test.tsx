import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";
import type { ReactNode } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import SymptomCatalog from "./symptom-catalog";
import {
  ORG_SYMPTOMS,
  PLATFORM_TEMPLATES,
  SymptomScopeProvider,
} from "./symptom-scope";

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  permissions: [] as string[],
  role: "OWNER",
  platformOwner: false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace, push: state.push }),
  usePathname: () => "/es/users/settings/symptoms",
  useSearchParams: () => state.params,
}));
vi.mock("./maintainer-api", () => ({
  useSymptomDefinitions: () => ({
    data: [],
    error: undefined,
    isLoading: false,
  }),
  useSymptomStats: () => ({ data: undefined }),
  useSymptomFamilies: () => ({ data: [] }),
  useControlTowerAccess: () => ({
    can: (p: string) => state.permissions.includes(p),
    canMaintain: state.permissions.includes("controltower:symptom.edit"),
  }),
  importEngineRules: vi.fn(),
  refreshSymptoms: vi.fn(),
}));
vi.mock("@/features/settings-admin/platform/use-platform-membership", () => ({
  useIsPlatformOwner: () => ({ isPlatformOwner: state.platformOwner }),
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({ activeOrg: { slug: "mintral", role: state.role } }),
  })
);
vi.mock("@/features/common/components/Breadcrumb/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));
vi.mock("./catalog-stats", () => ({ default: () => <p>Catalog stats</p> }));
vi.mock("./create-symptom-modal", () => ({ default: () => null }));
vi.mock("./team-settings", () => ({
  default: ({ lang }: { lang: string }) => <p>Team settings {lang}</p>,
}));
vi.mock("@/features/telephony/org-telephony-choice", () => ({
  OrgTelephonyChoice: ({ dict }: { dict: { title: string } }) => (
    <p>Telephony choice: {dict.title}</p>
  ),
  OrgTelephonyUsage: ({
    dict,
    orgSlug,
  }: {
    dict: { title: string };
    orgSlug: string;
  }) => (
    <p>
      Telephony usage: {dict.title} {orgSlug}
    </p>
  ),
}));

const settings = es.pages.userSettings;
const m = settings.symptomCatalog.menu;
const ALL = ["controltower:symptom.edit", "controltower:settings.update"];

function UnsavedTeam() {
  useUnsavedNavigation(true, "Discard draft?");
  return null;
}

function renderCatalog(scope: ReactNode = null, template = false) {
  return render(
    <SymptomScopeProvider value={template ? PLATFORM_TEMPLATES : ORG_SYMPTOMS}>
      {scope}
      <SymptomCatalog
        dict={settings as unknown as I18nRecord}
        rootDict={es as unknown as I18nRecord}
        lang="es"
        harnessEnabled={false}
      />
    </SymptomScopeProvider>
  );
}

const menu = () => screen.getByRole("complementary");
const entry = (label: string) =>
  within(menu()).queryByRole("button", { name: new RegExp(`^${label}`) });

describe("Ajustes › Síntomas menu", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    state.params = new URLSearchParams();
    state.replace.mockReset();
    state.permissions = ALL;
    state.role = "OWNER";
    state.platformOwner = false;
  });

  it("groups Síntomas under Catálogo and Equipo, Telefonía and Uso under Torre de Control", () => {
    renderCatalog();
    const text = menu().textContent ?? "";
    const order = [
      m.groups.catalog,
      m.sections.catalog.label,
      m.groups.tower,
      m.sections.team.label,
      m.sections.telephony.label,
      m.sections.usage.label,
    ].map((label) => text.indexOf(label));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(entry(m.sections.catalog.label)).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByText("Catalog stats")).toBeInTheDocument();
  });

  it.each([
    ["team", "Team settings es"],
    ["telephony", `Telephony choice: ${settings.telephony.choice.title}`],
    ["usage", `Telephony usage: ${settings.telephony.usage.title} mintral`],
  ])("?section=%s shows its section", (section, shown) => {
    state.params = new URLSearchParams(`section=${section}`);
    renderCatalog();
    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByText("Catalog stats")).toBeNull();
    expect(
      screen.queryByRole("button", { name: settings.symptomCatalog.newSymptom })
    ).toBeNull();
  });

  it("writes the section to the URL and drops it for the catalog", () => {
    state.params = new URLSearchParams("section=team");
    renderCatalog();
    fireEvent.click(entry(m.sections.telephony.label)!);
    expect(state.replace).toHaveBeenLastCalledWith(
      "/es/users/settings/symptoms?section=telephony",
      { scroll: false }
    );
    fireEvent.click(entry(m.sections.catalog.label)!);
    expect(state.replace).toHaveBeenLastCalledWith(
      "/es/users/settings/symptoms",
      { scroll: false }
    );
  });

  it("hides the entries the user cannot use and falls back to the catalog", () => {
    state.permissions = [];
    state.role = "MEMBER";
    state.params = new URLSearchParams("section=telephony");
    renderCatalog();
    expect(entry(m.sections.team.label)).toBeNull();
    expect(entry(m.sections.telephony.label)).toBeNull();
    expect(entry(m.sections.usage.label)).toBeNull();
    expect(within(menu()).queryByText(m.groups.tower)).toBeNull();
    expect(screen.getByText("Catalog stats")).toBeInTheDocument();
  });

  it("shows each Torre de Control entry by its own permission", () => {
    state.permissions = ["controltower:settings.update"];
    state.role = "MEMBER";
    renderCatalog();
    expect(entry(m.sections.team.label)).not.toBeNull();
    expect(entry(m.sections.telephony.label)).not.toBeNull();
    expect(entry(m.sections.usage.label)).toBeNull();
  });

  it("does not offer team settings to a symptom editor without settings-update access", () => {
    state.permissions = ["controltower:symptom.edit"];
    state.role = "MEMBER";
    state.params = new URLSearchParams("section=team");
    renderCatalog();
    expect(entry(m.sections.team.label)).toBeNull();
    expect(screen.getByText("Catalog stats")).toBeInTheDocument();
  });

  it("keeps the current section when unsaved changes are not discarded", () => {
    state.params = new URLSearchParams("section=team&source=shared");
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    renderCatalog(<UnsavedTeam />);
    fireEvent.click(entry(m.sections.team.label)!);
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(entry(m.sections.telephony.label)!);
    expect(confirm).toHaveBeenCalledWith("Discard draft?");
    expect(state.replace).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(entry(m.sections.telephony.label)!);
    expect(state.replace).toHaveBeenCalledWith(
      "/es/users/settings/symptoms?section=telephony&source=shared",
      { scroll: false }
    );
  });

  it("under the platform scope lists only the templates", () => {
    state.platformOwner = true;
    renderCatalog(null, true);
    expect(entry(m.sections.catalog.label)).not.toBeNull();
    expect(entry(m.sections.team.label)).toBeNull();
    expect(entry(m.sections.telephony.label)).toBeNull();
    expect(entry(m.sections.usage.label)).toBeNull();
  });
});
