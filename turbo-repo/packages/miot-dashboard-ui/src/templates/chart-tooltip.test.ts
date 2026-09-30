import { expect, it, vi } from "vitest";
import { createChartTooltipFormatter } from "./chart-tooltip";
import { createTemplateEngine } from "./engine";

const rows = [{ name: "first" }, { name: "second" }, { name: "third" }];
it("keeps source rows for filtered pie and colored or plain scatter points", () => {
  const format = createChartTooltipFormatter("{{row.name}}", rows);
  expect(
    format({ dataIndex: 0, data: { name: "third", value: 9, rowIndex: 2 } }),
  ).toBe("third");
  expect(
    format({
      dataIndex: 0,
      data: { value: [4, 5, 1], itemStyle: { color: "red" } },
    }),
  ).toBe("second");
  expect(format({ dataIndex: 0, data: [4, 5, 2] })).toBe("third");
  expect(format({ dataIndex: 1, data: 42 })).toBe("second");
  expect(format({ dataIndex: 2, data: { value: 42 } })).toBe("third");
});

it("compiles once and preserves plain text, newlines and prototype protection", () => {
  const engine = createTemplateEngine();
  const compile = vi.spyOn(engine, "compileTextTemplate");
  const format = createChartTooltipFormatter(
    "{{row.name}}\n{{{name}}}",
    [{ name: '<img src=x onerror="alert(1)"> & costs' }],
    engine,
  );
  const text = '<img src=x onerror="alert(1)"> & costs';
  expect(format({ dataIndex: 0 })).toBe(text + "\n" + text);
  expect(format({ dataIndex: 0 })).toBe(text + "\n" + text);
  expect(compile).toHaveBeenCalledOnce();
  expect(
    createChartTooltipFormatter("{{row.constructor}}", rows)({ dataIndex: 0 }),
  ).toBe("");
});

it("rejects invalid indices and handles malformed templates without throwing", () => {
  const format = createChartTooltipFormatter("{{name}}", rows);
  for (const params of [
    null,
    [],
    {},
    { dataIndex: -1 },
    { dataIndex: 0.5 },
    { dataIndex: 99 },
    { dataIndex: 0, data: [1, 2, -1] },
  ]) {
    expect(format(params)).toBe("");
  }
  expect(createChartTooltipFormatter("{{broken", rows)({ dataIndex: 0 })).toBe(
    "{{broken",
  );
});
