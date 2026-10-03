// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useCompiledColumns } from "./use-compiled-columns";
import { createTemplateEngine } from "../templates";
it("resolves values, labels and dynamic types with row index/count context", () => {
  const key = "{{row.service}} {{_index}}/{{_count}}";
  const { result, rerender } = renderHook(
    ({ count }) =>
      useCompiledColumns(
        [
          {
            key,
            label: "Services ({{_count}})",
            type: "{{#if row.alert}}badge{{else}}text{{/if}}",
          },
        ],
        count,
      ),
    { initialProps: { count: 2 } },
  );
  expect(
    result.current.resolveValue(key, { service: "BQ", alert: "yes" }, 1, 2),
  ).toBe("BQ 1/2");
  expect(result.current.resolveLabel(key)).toBe("Services (2)");
  expect(
    result.current.resolveType(key, { service: "BQ", alert: "yes" }, 1, 2),
  ).toBe("badge");
  expect(result.current.resolveType(key, { service: "BQ" }, 0, 2)).toBe("text");
  rerender({ count: 3 });
  expect(result.current.resolveLabel(key)).toBe("Services (3)");
});
it("uses own row values and safe fallbacks for plain or invalid columns", () => {
  const { result } = renderHook(() =>
    useCompiledColumns(
      [
        { key: "cost", label: "Cost", type: " " },
        { key: "{{broken", label: "{{broken", type: "" },
      ],
      1,
    ),
  );
  expect(result.current.resolveValue("cost", { cost: "12" }, 0, 1)).toBe("12");
  expect(result.current.resolveValue("constructor", {}, 0, 1)).toBe(
    "constructor",
  );
  expect(result.current.resolveValue("{{broken", {}, 0, 1)).toBe("{{broken");
  expect(result.current.resolveLabel("{{broken")).toBe("{{broken");
  expect(result.current.resolveType("cost", {}, 0, 1)).toBe("text");
  expect(result.current.resolveType("unknown", {}, 0, 1)).toBe("text");
});
it("isolates custom helper engines and updates columns without retaining old templates", () => {
  const key = "{{tenant}}";
  const first = createTemplateEngine({ helpers: { tenant: () => "First" } });
  const second = createTemplateEngine({ helpers: { tenant: () => "Second" } });
  const a = renderHook(
    ({ engine, columns }) =>
      useCompiledColumns(columns, 1, { templateEngine: engine }),
    {
      initialProps: {
        engine: first,
        columns: [{ key, label: "Name", type: "text" }],
      },
    },
  );
  const b = renderHook(() =>
    useCompiledColumns([{ key, label: "Name", type: "text" }], 1, {
      templateEngine: second,
    }),
  );
  expect(a.result.current.resolveValue(key, {}, 0, 1)).toBe("First");
  expect(b.result.current.resolveValue(key, {}, 0, 1)).toBe("Second");
  a.rerender({
    engine: second,
    columns: [{ key: "cost", label: "Value", type: "signed" }],
  });
  expect(a.result.current.resolveValue(key, {}, 0, 1)).toBe(key);
  expect(a.result.current.resolveLabel("cost")).toBe("Value");
});
