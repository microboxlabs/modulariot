import { describe, expect, it } from "vitest";
import {
  CreateDataSourceSchema,
  EditDataSourceFormSchema,
  UpdateDataSourceSchema,
} from "./types";

const form = {
  name: "Sample",
  type: "POSTGREST",
  url: "https://example.com",
  authMethod: "TOKEN",
};

describe("data source form schemas", () => {
  it("requires a token when creating and permits retaining it when editing", () => {
    expect(CreateDataSourceSchema.safeParse(form).success).toBe(false);
    expect(EditDataSourceFormSchema.safeParse(form).success).toBe(true);
  });

  it("validates the editor's full visible fields while keeping API updates partial", () => {
    expect(
      UpdateDataSourceSchema.safeParse({ description: null }).success
    ).toBe(true);
    expect(
      EditDataSourceFormSchema.safeParse({ description: "Sample" }).success
    ).toBe(false);
  });
});
