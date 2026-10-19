import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowDashboardDraftArgs } from "../dashboard-draft";
import { ShowDashboardDraftCard } from "./show-dashboard-draft-card";

const site = vi.hoisted(() => ({ siteName: "ops" as string | null }));
const mutate = vi.hoisted(() => vi.fn());

vi.mock("../../context/harness-chat-i18n-context", () => ({
  useHarnessChatTr: () => (key: string, params?: Record<string, string>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));
vi.mock("@/features/common/providers/client-api.provider", () => ({
  useUserSite: () => ({ siteName: site.siteName, siteTitle: "Operations" }),
}));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock("@/features/dashboard/dashlets/dashlet-preview", () => ({
  resolveDashletPreview: (dashletId: string) => ({
    status: "ok",
    Component: () => <div data-testid="dashlet">{dashletId}</div>,
    widget: {},
    heightPx: 55,
  }),
}));

const draft: ShowDashboardDraftArgs = {
  id: "d1",
  title: "Semana",
  description: "Viajes de la semana",
  dashlets: [
    { widgetId: "w1", dashletId: "stat_icon", config: { title: "Viajes" } },
    { widgetId: "w2", dashletId: "chart_v2", config: { title: "Por día" } },
  ],
  missing: ["w9"],
};

type CardProps = ComponentProps<typeof ShowDashboardDraftCard>;

function renderCard(args: ShowDashboardDraftArgs = draft) {
  const props = {
    args,
    result: {},
    addResult: vi.fn(),
  } as unknown as CardProps;
  return render(<ShowDashboardDraftCard {...props} />);
}

describe("ShowDashboardDraftCard", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    site.siteName = "ops";
    window.localStorage.clear();
    fetchMock.mockReset();
    mutate.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("previews the dashlets and says which widgets were left out", () => {
    renderCard();
    expect(screen.getAllByTestId("dashlet").map((d) => d.textContent)).toEqual([
      "stat_icon",
      "chart_v2",
    ]);
    expect(screen.getByText(/dashboardDraft.missing/).textContent).toContain(
      '"count":"1"'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves under a free slug in the user's site and then links to the dashboard", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response("{}", { status: 200 });
      return Response.json({ data: url.endsWith("slug=semana") ? {} : null });
    });

    renderCard();
    fireEvent.click(
      screen.getByRole("button", {
        name: "harnessChat.ui.dashboardDraft.create",
      })
    );

    const link = await screen.findByRole("link", {
      name: "harnessChat.ui.dashboardDraft.open",
    });
    expect(link.getAttribute("href")).toBe("/es/home/semana-2");
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const body = JSON.parse(String(put![1].body));
    expect(body.site).toBe("ops");
    expect(body.slug).toBe("semana-2");
    expect(body.config.name).toBe("Semana");
    expect(
      body.config.widgets.map((w: { componentId: string }) => w.componentId)
    ).toEqual(["stat_icon", "chart_v2"]);
    expect(window.localStorage.getItem("harness-dashboard-draft:d1")).toBe(
      "semana-2"
    );
    expect(mutate).toHaveBeenCalledWith("/app/api/dashboard/configs?site=ops");
  });

  it("shows the link again after a reload", () => {
    window.localStorage.setItem("harness-dashboard-draft:d1", "semana");
    renderCard();
    expect(
      screen
        .getByRole("link", { name: "harnessChat.ui.dashboardDraft.open" })
        .getAttribute("href")
    ).toBe("/es/home/semana");
  });

  it("says so when the save fails and keeps the button", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    renderCard();
    fireEvent.click(
      screen.getByRole("button", {
        name: "harnessChat.ui.dashboardDraft.create",
      })
    );
    await waitFor(() =>
      expect(
        screen.getByText("harnessChat.ui.dashboardDraft.error")
      ).toBeTruthy()
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("cannot save without a site", () => {
    site.siteName = null;
    renderCard();
    expect(
      screen.getByText("harnessChat.ui.dashboardDraft.noSite")
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "harnessChat.ui.dashboardDraft.create",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
