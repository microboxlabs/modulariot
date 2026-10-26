import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, FeedBody } from "./feeds-api";
import FeedsPanel from "./feeds-panel";

const api = vi.hoisted(() => ({ save: vi.fn(), feeds: [] as Feed[] }));
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string, _d: unknown, vars?: Record<string, string>) =>
    vars ? `${key} ${Object.values(vars).join(" ")}` : key,
}));
vi.mock("../monitors/monitors-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../monitors/monitors-api")>()),
  useTripsPermission: () => true,
}));
vi.mock("./feeds-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./feeds-api")>()),
  useFeeds: () => ({ data: api.feeds, isLoading: false }),
  saveFeed: (key: string, body: FeedBody) => api.save(key, body),
}));

const feed: Feed = {
  feedKey: "test-feed",
  name: "Test feed",
  stages: [
    { stageType: "preparation", serviceStatus: "ADDED" },
    { stageType: "transit", serviceStatus: "SCHEDULED" },
  ],
  arrivalStage: "transit",
  requiredResources: ["truck", "driver"],
  active: false,
  openServices: 3,
  updatedAt: null,
  updatedBy: null,
};

describe("FeedsPanel", () => {
  beforeEach(() => {
    api.save.mockReset().mockResolvedValue(feed);
    api.feeds = [feed];
  });

  it("lists each feed with its stages, resources, open services and state", () => {
    render(
      <FeedsPanel creating={false} onCreatingDone={() => {}} d={{}} md={{}} />
    );
    expect(screen.getByText("Test feed")).toBeInTheDocument();
    expect(screen.getByText("test-feed")).toBeInTheDocument();
    expect(screen.getByText("stages.transit")).toBeInTheDocument();
    expect(
      screen.getByText("resources.truck, resources.driver")
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("inactive")).toBeInTheDocument();
  });

  it("saves an edited feed under its key, which stays fixed", async () => {
    render(
      <FeedsPanel creating={false} onCreatingDone={() => {}} d={{}} md={{}} />
    );
    fireEvent.click(screen.getByText("edit"));
    expect(screen.getByLabelText("key")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Renamed feed" },
    });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith("test-feed", {
        name: "Renamed feed",
        stages: feed.stages,
        arrivalStage: "transit",
        requiredResources: ["truck", "driver"],
        active: false,
      })
    );
  });

  it("does not create a feed until it has a name, a free key, stages and an arrival stage", () => {
    render(<FeedsPanel creating onCreatingDone={() => {}} d={{}} md={{}} />);
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Test feed" },
    });
    expect(screen.getByLabelText("key")).toHaveValue("test-feed");
    expect(screen.getByText("keyTaken")).toBeInTheDocument();
    expect(screen.getByText("create")).toBeDisabled();
  });

  it("locks form values during a save and restores them when it fails", async () => {
    let fail: (error: Error) => void = () => {};
    api.save.mockReturnValue(
      new Promise<Feed>((_resolve, reject) => {
        fail = reject;
      })
    );
    render(
      <FeedsPanel creating={false} onCreatingDone={() => {}} d={{}} md={{}} />
    );
    fireEvent.click(screen.getByText("edit"));
    fireEvent.click(screen.getByText("save"));
    const name = screen.getByLabelText("name");
    expect(name).toBeDisabled();
    expect(screen.getByLabelText("arrivalStage")).toBeDisabled();
    expect(screen.getByLabelText("resources.truck")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "activeLabel" })).toBeDisabled();
    await act(async () => fail(new Error("Save failed")));
    await waitFor(() => expect(name).toBeEnabled());
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });
});
