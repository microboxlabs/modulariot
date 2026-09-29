import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getThread, type StoredThread } from "../harness-thread-store";
import { useHarnessModels } from "./use-harness-models";
import { useThreadModel } from "./use-thread-model";

vi.mock("../harness-thread-store", () => ({ getThread: vi.fn() }));
vi.mock("./use-harness-models", () => ({ useHarnessModels: vi.fn() }));

const getThreadMock = vi.mocked(getThread);
const modelsMock = vi.mocked(useHarnessModels);

function thread(model: string | null): StoredThread {
  return {
    id: "t1",
    title: "chat",
    summary: null,
    model,
    ownerId: "me",
    owned: true,
    expiresAt: null,
    lastMessageAt: null,
    createdAt: "2026-09-28T00:00:00Z",
    updatedAt: "2026-09-28T00:00:00Z",
    sharedWith: [],
  };
}

function useSession(initial: string | null) {
  const [model, setModel] = useState<string | null>(initial);
  useThreadModel("t1", setModel);
  return model;
}

describe("useThreadModel", () => {
  beforeEach(() => {
    modelsMock.mockReturnValue({
      default: "llmgateway:deepseek-v4-flash",
      models: ["llmgateway:deepseek-v4-flash", "claude-opus-5-5"],
      status: "ready",
      retry: () => {},
    });
  });

  it("starts a reopened thread on the model it last ran on", async () => {
    getThreadMock.mockResolvedValue(thread("claude-opus-5-5"));
    const { result } = renderHook(() => useSession(null));
    await waitFor(() => expect(result.current).toBe("claude-opus-5-5"));
  });

  it("keeps a model the user already picked", async () => {
    getThreadMock.mockResolvedValue(thread("claude-opus-5-5"));
    const { result } = renderHook(() =>
      useSession("llmgateway:deepseek-v4-flash")
    );
    await waitFor(() => expect(getThreadMock).toHaveBeenCalled());
    expect(result.current).toBe("llmgateway:deepseek-v4-flash");
  });

  it("ignores a model that is no longer offered", async () => {
    getThreadMock.mockResolvedValue(thread("openrouter:retired-model"));
    const { result } = renderHook(() => useSession(null));
    await waitFor(() => expect(getThreadMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
