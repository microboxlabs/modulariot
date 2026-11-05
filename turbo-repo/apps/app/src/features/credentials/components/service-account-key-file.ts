import { z } from "zod/v3";

const KeyFileSchema = z.object({
  type: z.literal("service_account"),
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().includes("PRIVATE KEY"),
});

export interface ServiceAccountKeyFields {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

/** The three credential fields from a Google service account JSON key file, or null when it is not one. */
export function parseServiceAccountKeyFile(
  text: string
): ServiceAccountKeyFields | null {
  try {
    const parsed = KeyFileSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    return {
      projectId: parsed.data.project_id,
      clientEmail: parsed.data.client_email,
      privateKey: parsed.data.private_key,
    };
  } catch {
    return null;
  }
}
