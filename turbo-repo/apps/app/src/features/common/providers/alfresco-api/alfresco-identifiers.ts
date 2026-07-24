import { z } from "zod";

/** Alfresco node IDs are UUIDs or well-known aliases like -root-, -my-, -shared-. */
export const alfrescoNodeIdSchema = z
  .string()
  .regex(
    /^(-root-|-my-|-shared-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    "Invalid Alfresco node ID"
  );

/** Task IDs are used as one path segment by Alfresco's form processor. */
const alfrescoTaskIdSchema = z
  .string()
  .regex(/^(?:activiti\$)?[A-Za-z0-9._-]+$/, "Invalid Alfresco task ID");

/**
 * Returns the node ID from a bare ID or a legacy workspace node reference.
 * Only the exact workspace/SpacesStore form is accepted to keep it a single
 * URL path segment when the caller builds an Alfresco endpoint.
 */
export function normalizeAlfrescoNodeReference(
  reference: string
): string | null {
  const directNodeId = alfrescoNodeIdSchema.safeParse(reference);
  if (directNodeId.success) {
    return directNodeId.data;
  }

  const match = /^workspace(?::\/\/|\/)SpacesStore\/(.+)$/i.exec(reference);
  if (!match?.[1]) {
    return null;
  }

  const referencedNodeId = alfrescoNodeIdSchema.safeParse(match[1]);
  return referencedNodeId.success ? referencedNodeId.data : null;
}

/** Normalizes a task ID to Alfresco's form-processor path format. */
export function normalizeAlfrescoTaskId(taskId: string): string {
  const parsedTaskId = alfrescoTaskIdSchema.parse(taskId);
  return parsedTaskId.startsWith("activiti$")
    ? parsedTaskId
    : `activiti$${parsedTaskId}`;
}
