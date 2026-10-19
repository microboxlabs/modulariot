import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ShowNotification } from "@/features/notifications/notification";
import { useFieldSelectableBinding } from "./field-bindings";

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));
vi.mock("./selectables-api", () => ({
  bindingsKey: "/api/selectables/bindings",
  useSelectableBindings: () => ({ data: {} }),
  updateSelectableBindings: () => Promise.reject("not an Error"),
}));

describe("useFieldSelectableBinding", () => {
  it("reports a failed save in the caller's language", async () => {
    const { result } = renderHook(() =>
      useFieldSelectableBinding("call_tags", "Could not save")
    );

    act(() => result.current[1]("other_list"));

    await waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: "Could not save",
      })
    );
  });
});
