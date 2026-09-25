import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useSelectableOptions } from "./selectables-api";

function fresh({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("useSelectableOptions", () => {
  it("drops the old parent's options while the new parent's load", async () => {
    let answer: (body: string) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.includes("parent=CL-RM")
          ? Promise.resolve(new Response('[{"value":"santiago","label":{}}]'))
          : new Promise<Response>((resolve) => {
              answer = (body) => resolve(new Response(body));
            })
      )
    );

    const { result, rerender } = renderHook(
      ({ parents }: { parents: string[] }) =>
        useSelectableOptions("commune", { parents }),
      { wrapper: fresh, initialProps: { parents: ["CL-RM"] } }
    );
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    rerender({ parents: ["CL-VS"] });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    answer('[{"value":"valparaiso","label":{}}]');
    await waitFor(() =>
      expect(result.current.data?.[0]?.value).toBe("valparaiso")
    );
  });
});
