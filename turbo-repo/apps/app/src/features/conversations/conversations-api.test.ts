import { mutate } from "swr";
import { afterEach, expect, it } from "vitest";
import { orgMetaTemplatesKey, refreshMetaTemplates } from "./conversations-api";
import type { MetaTemplate } from "./conversations-types";

const existing: MetaTemplate = {
  id: "template",
  name: "quota_alert",
  language: "es",
  category: "UTILITY",
  status: "APPROVED",
  rejectedReason: null,
  parameterFormat: "NAMED",
  headerFormat: null,
  header: null,
  body: "Quota",
  footer: null,
  buttons: [],
  params: [],
  examples: {},
};

afterEach(async () => {
  await mutate(orgMetaTemplatesKey, undefined, { revalidate: false });
});

it("stores the accepted Meta response without overwriting another language or refetching stale data", async () => {
  const other = { ...existing, id: "other", language: "en" };
  await mutate(orgMetaTemplatesKey, [existing, other], { revalidate: false });
  const submitted = { ...existing, status: "PENDING", body: "Updated quota" };
  await refreshMetaTemplates(submitted);
  expect(await mutate<MetaTemplate[]>(orgMetaTemplatesKey)).toEqual([
    other,
    submitted,
  ]);
});
