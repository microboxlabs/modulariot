// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelapseData } from "../../hooks/use-timelapse";
import ImageSelector from "./image-selector";

vi.mock("./image-viewer", () => ({ default: () => null }));
vi.mock("./video-viewer", () => ({ default: () => null }));

const timelapse = {
  proxyStreamUrl: "/app/api/timelapse/stream?session_id=s1",
  estimatedDurationSeconds: 75,
  state: "READY",
} as unknown as TimelapseData;

const DURATION = "1:15";

let paused = true;
const onUnhandledRejection = vi.fn();

function renderFrame() {
  const { container } = render(
    <ImageSelector images={[]} dictionary={{}} timelapse={timelapse} />
  );
  const video = container.querySelector("video");
  if (!video) throw new Error("video not rendered");
  return video.closest("button") as HTMLButtonElement;
}

async function flushRejections() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("VideoFilmstripFrame play toggle", () => {
  beforeEach(() => {
    paused = true;
    onUnhandledRejection.mockClear();
    process.on("unhandledRejection", onUnhandledRejection);
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(
      () => paused
    );
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandledRejection);
    vi.restoreAllMocks();
    cleanup();
  });

  it("returns to the paused overlay when play() is blocked by autoplay policy", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("blocked", "NotAllowedError")
    );
    const frame = renderFrame();

    fireEvent.click(frame);
    await flushRejections();

    expect(screen.getByText(DURATION)).toBeInTheDocument();
    expect(onUnhandledRejection).not.toHaveBeenCalled();
  });

  type PendingPlay = {
    resolve: () => void;
    reject: (reason: unknown) => void;
  };
  const noop = () => {};

  it.each([
    [
      "stays paused when a pause interrupts a play() that has not resolved yet",
      (play: PendingPlay) =>
        play.reject(new DOMException("interrupted by pause", "AbortError")),
      noop,
    ],
    [
      "stays paused when a pending play() resolves after the pause",
      noop,
      (play: PendingPlay) => play.resolve(),
    ],
  ])("%s", async (_name, settleOnPause, settleAfterPause) => {
    const pending: PendingPlay = { resolve: noop, reject: noop };
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement
    ) {
      paused = false;
      this.dispatchEvent(new Event("play"));
      return new Promise<void>((resolve, reject) => {
        pending.resolve = resolve;
        pending.reject = reject;
      });
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement
    ) {
      paused = true;
      this.dispatchEvent(new Event("pause"));
      settleOnPause(pending);
    });
    const frame = renderFrame();

    fireEvent.click(frame);
    expect(screen.queryByText(DURATION)).not.toBeInTheDocument();

    fireEvent.click(frame);
    settleAfterPause(pending);
    await flushRejections();

    expect(screen.getByText(DURATION)).toBeInTheDocument();
    expect(onUnhandledRejection).not.toHaveBeenCalled();
  });
});
