import { expect, it } from "vitest";
import {
  fromActionItems,
  fromRowActionItems,
  isSafeActionUrl,
  normalizeActionsConfig,
  normalizeRowActions,
  toActionItems,
  toRowActionItems,
} from "./action-helpers";
import type { ActionItem, ActionsConfig, RowAction } from "./action-types";

it.each([
  "/app/dashboard",
  "../details?id=5",
  "#section",
  "?page=2",
  "//example.com/report",
  "https://example.com",
  "http://localhost:3070",
  "mailto:person@example.com",
  "tel:+123",
  "/details/{{row.id}}",
  "{{row.url}}",
])("accepts supported destination %s", (url) => {
  expect(isSafeActionUrl(url)).toBe(true);
});
it.each([
  "",
  "   ",
  "javascript:alert(1)",
  "  JaVaScRiPt:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "java\rscript:alert(1)",
  "\u0000javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "blob:https://example.com/id",
  "custom:launch",
])("rejects unsupported or obfuscated URL %s", (url) => {
  expect(isSafeActionUrl(url)).toBe(false);
});
it("normalizes supported actions and drops unsafe resolved row destinations", () => {
  const item: ActionItem = {
    name: "Open",
    link: "/details/{{row.id}}",
    target: "_blank",
  };
  const row: RowAction = { ...item, method: "goto" };
  const fallback: ActionsConfig = { enabled: false, items: [] };
  expect(
    normalizeActionsConfig({ enabled: true, items: [item] }, fallback),
  ).toEqual({ enabled: true, items: [item] });
  expect(
    normalizeActionsConfig(
      { enabled: true, items: [{ ...item, link: "java\nscript:alert(1)" }] },
      fallback,
    ),
  ).toBe(fallback);
  expect(
    normalizeRowActions([
      row,
      { ...row, target: "_parent" },
      { ...row, method: "post" },
      { ...row, link: "data:x" },
      null,
    ]),
  ).toEqual([row]);
  expect(normalizeRowActions(Object.create(row))).toEqual([]);
  expect(normalizeRowActions([Object.create(row)])).toEqual([]);
  expect(
    normalizeActionsConfig(
      { enabled: true, items: [Object.create(item)] },
      fallback,
    ),
  ).toBe(fallback);
});
it("round trips editor identifiers without leaking them into persisted actions", () => {
  const items: ActionItem[] = [
    { name: "Open", link: "/item", target: "_self" },
  ];
  expect(fromActionItems(toActionItems(items))).toEqual(items);
  const rows: RowAction[] = items.map((item) => ({ ...item, method: "goto" }));
  expect(fromRowActionItems(toRowActionItems(rows))).toEqual(rows);
  expect(items[0]).not.toHaveProperty("_id");
});
