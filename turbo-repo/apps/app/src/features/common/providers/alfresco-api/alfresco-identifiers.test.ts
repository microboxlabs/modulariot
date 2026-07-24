import { describe, expect, it } from "vitest";
import {
  alfrescoNodeIdSchema,
  normalizeAlfrescoNodeReference,
  normalizeAlfrescoTaskId,
} from "./alfresco-identifiers";

const NODE_ID = "1c903be0-1234-4abc-8def-0123456789ab";

describe("Alfresco identifier validation", () => {
  it("accepts Alfresco node UUIDs and supported aliases", () => {
    expect(alfrescoNodeIdSchema.parse(NODE_ID)).toBe(NODE_ID);
    expect(alfrescoNodeIdSchema.parse("-shared-")).toBe("-shared-");
  });

  it("rejects node IDs that can alter a URL path or query", () => {
    expect(alfrescoNodeIdSchema.safeParse("../admin").success).toBe(false);
    expect(alfrescoNodeIdSchema.safeParse(`${NODE_ID}?a=true`).success).toBe(
      false
    );
    expect(alfrescoNodeIdSchema.safeParse("https://example.test").success).toBe(
      false
    );
  });

  it("normalizes only supported legacy workspace references", () => {
    expect(normalizeAlfrescoNodeReference(NODE_ID)).toBe(NODE_ID);
    expect(
      normalizeAlfrescoNodeReference(`workspace/SpacesStore/${NODE_ID}`)
    ).toBe(NODE_ID);
    expect(
      normalizeAlfrescoNodeReference(`workspace://SpacesStore/${NODE_ID}`)
    ).toBe(NODE_ID);
    expect(
      normalizeAlfrescoNodeReference("workspace/SpacesStore/../admin")
    ).toBeNull();
    expect(
      normalizeAlfrescoNodeReference("other/SpacesStore/" + NODE_ID)
    ).toBeNull();
  });

  it("normalizes form-processor task IDs to one safe path segment", () => {
    expect(normalizeAlfrescoTaskId("task-1")).toBe("activiti$task-1");
    expect(normalizeAlfrescoTaskId("activiti$task-1")).toBe("activiti$task-1");
    expect(() => normalizeAlfrescoTaskId("task-1/../../admin")).toThrow(
      "Invalid Alfresco task ID"
    );
  });
});
