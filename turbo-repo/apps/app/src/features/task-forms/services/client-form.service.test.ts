import { describe, it, expect } from "vitest";
import { formDataToObject } from "./client-form.service";

describe("formDataToObject", () => {
  it("converts whitelisted boolean field 'isMultiReason' with value 'true' to boolean true", () => {
    const fd = new FormData();
    fd.append("isMultiReason", "true");

    const result = formDataToObject(fd);

    expect(result.isMultiReason).toBe(true);
  });

  it("converts whitelisted boolean field 'isMultiReason' with value 'false' to boolean false", () => {
    const fd = new FormData();
    fd.append("isMultiReason", "false");

    const result = formDataToObject(fd);

    expect(result.isMultiReason).toBe(false);
  });

  it("does NOT coerce non-whitelisted fields containing 'true' to boolean", () => {
    const fd = new FormData();
    fd.append("reason", "true");

    const result = formDataToObject(fd);

    expect(result.reason).toBe("true");
    expect(typeof result.reason).toBe("string");
  });

  it("does NOT coerce non-whitelisted fields containing 'false' to boolean", () => {
    const fd = new FormData();
    fd.append("comments", "false");

    const result = formDataToObject(fd);

    expect(result.comments).toBe("false");
    expect(typeof result.comments).toBe("string");
  });

  it("parses JSON array strings", () => {
    const fd = new FormData();
    fd.append("reasons", JSON.stringify(["reason1", "reason2"]));

    const result = formDataToObject(fd);

    expect(result.reasons).toEqual(["reason1", "reason2"]);
  });

  it("parses JSON object strings", () => {
    const fd = new FormData();
    fd.append("data", JSON.stringify({ key: "value" }));

    const result = formDataToObject(fd);

    expect(result.data).toEqual({ key: "value" });
  });

  it("keeps invalid JSON strings as plain strings", () => {
    const fd = new FormData();
    fd.append("broken", "[not valid json");

    const result = formDataToObject(fd);

    expect(result.broken).toBe("[not valid json");
  });

  it("passes through regular string values unchanged", () => {
    const fd = new FormData();
    fd.append("taskId", "abc-123");
    fd.append("comments", "some comment");

    const result = formDataToObject(fd);

    expect(result.taskId).toBe("abc-123");
    expect(result.comments).toBe("some comment");
  });

  it("handles mixed field types correctly", () => {
    const fd = new FormData();
    fd.append("taskId", "t-1");
    fd.append("isMultiReason", "true");
    fd.append("reason", "true");
    fd.append("reasons", JSON.stringify(["a", "b"]));

    const result = formDataToObject(fd);

    expect(result.taskId).toBe("t-1");
    expect(result.isMultiReason).toBe(true);
    expect(result.reason).toBe("true");
    expect(result.reasons).toEqual(["a", "b"]);
  });
});
