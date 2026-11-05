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

const api = vi.hoisted(() => ({
  save: vi.fn(),
  feeds: [] as Feed[] | undefined,
  isLoading: false,
  error: undefined as Error | undefined,
}));
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
  useFeeds: () => ({
    data: api.feeds,
    isLoading: api.isLoading,
    error: api.error,
  }),
  saveFeed: (key: string, body: FeedBody, createOnly: boolean) =>
    api.save(key, body, createOnly),
}));

const feed: Feed = {
  feedKey: "test-feed",
  name: "Test feed",
  country: "CL",
  stages: [
    { stageType: "preparation", serviceStatus: "ADDED" },
    { stageType: "transit", serviceStatus: "SCHEDULED" },
  ],
  arrivalStage: "transit",
  requiredResources: ["truck", "driver"],
  registersResources: true,
  active: false,
  openServices: 3,
  updatedAt: null,
  updatedBy: null,
};

describe("FeedsPanel", () => {
  beforeEach(() => {
    api.save.mockReset().mockResolvedValue(feed);
    api.feeds = [feed];
    api.isLoading = false;
    api.error = undefined;
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
    expect(screen.getByLabelText("country")).toHaveValue("CL");
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Renamed feed" },
    });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "test-feed",
        {
          name: "Renamed feed",
          country: "CL",
          stages: feed.stages,
          arrivalStage: "transit",
          requiredResources: ["truck", "driver"],
          registersResources: true,
          active: false,
        },
        false
      )
    );
  });

  it("validates, uppercases and clears the optional country", async () => {
    render(
      <FeedsPanel creating={false} onCreatingDone={() => {}} d={{}} md={{}} />
    );
    fireEvent.click(screen.getByText("edit"));
    const country = screen.getByLabelText("country");
    fireEvent.change(country, { target: { value: "C1" } });
    expect(screen.getByText("save")).toBeDisabled();
    expect(country).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(country, { target: { value: "pe" } });
    expect(country).toHaveValue("PE");
    expect(screen.getByText("save")).toBeEnabled();
    fireEvent.change(country, { target: { value: "" } });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "test-feed",
        expect.objectContaining({ country: null }),
        false
      )
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
    expect(screen.getByLabelText("country")).toBeDisabled();
    expect(screen.getByLabelText("arrivalStage")).toBeDisabled();
    expect(screen.getByLabelText("resources.truck")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "activeLabel" })).toBeDisabled();
    await act(async () => fail(new Error("Save failed")));
    await waitFor(() => expect(name).toBeEnabled());
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });

  it("uses creation semantics and preserves the form when a stale key is rejected", async () => {
    api.feeds = [];
    api.save.mockRejectedValue(new Error("feed new-feed already exists"));
    render(<FeedsPanel creating onCreatingDone={() => {}} d={{}} md={{}} />);
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "New feed" },
    });
    fireEvent.click(screen.getByText("addStage"));
    fireEvent.change(screen.getByLabelText("arrivalStage"), {
      target: { value: "preparation" },
    });
    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "new-feed",
        expect.any(Object),
        true
      )
    );
    expect(
      await screen.findByText("feed new-feed already exists")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("name")).toHaveValue("New feed");
  });

  it.each(["loading", "failed"])(
    "blocks creation while the feed list is %s",
    (state) => {
      api.feeds = undefined;
      api.isLoading = state === "loading";
      api.error = state === "failed" ? new Error("List failed") : undefined;
      const { rerender } = render(
        <FeedsPanel creating onCreatingDone={() => {}} d={{}} md={{}} />
      );
      fireEvent.change(screen.getByLabelText("name"), {
        target: { value: "New feed" },
      });
      fireEvent.click(screen.getByText("addStage"));
      fireEvent.change(screen.getByLabelText("arrivalStage"), {
        target: { value: "preparation" },
      });
      expect(screen.getByText("create")).toBeDisabled();
      api.feeds = [];
      api.isLoading = false;
      api.error = undefined;
      rerender(
        <FeedsPanel creating onCreatingDone={() => {}} d={{}} md={{}} />
      );
      expect(screen.getByText("create")).toBeEnabled();
    }
  );
});
