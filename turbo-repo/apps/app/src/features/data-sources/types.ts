import { z } from "zod";

export type AuthMethod = "TOKEN" | "OAUTH";

export interface DataSourceListItem {
  id: string;
  name: string;
  type: "POSTGREST";
  description?: string;
  siteId: string;
  authMethod: AuthMethod;
  connectionConfig: {
    url: string;
    maskedToken?: string;
    clientId?: string;
    maskedClientSecret?: string;
    tokenUrl?: string;
    scope?: string;
    audience?: string;
    tokenRequestFormat?: "form" | "json";
  };
  isActive: boolean;
  lastTestedAt?: string;
  lastTestResult?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DataSourceFormData {
  name: string;
  type: "POSTGREST";
  description?: string;
  url: string;
  authMethod: AuthMethod;
  // Token auth
  token?: string;
  // OAuth auth
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scope?: string;
  audience?: string;
  tokenRequestFormat?: "form" | "json";
}

const baseFields = {
  name: z.string().min(1, "validation.nameRequired").max(100),
  type: z.enum(["POSTGREST"]),
  description: z.string().max(500).optional(),
  url: z.string().url("validation.urlInvalid"),
  authMethod: z.enum(["TOKEN", "OAUTH"]),
};

const tokenCreateFields = z.object({
  ...baseFields,
  authMethod: z.literal("TOKEN"),
  token: z.string().min(1, "validation.tokenRequired"),
});

const oauthCreateFields = z.object({
  ...baseFields,
  authMethod: z.literal("OAUTH"),
  clientId: z.string().min(1, "validation.clientIdRequired"),
  clientSecret: z.string().min(1, "validation.clientSecretRequired"),
  tokenUrl: z.string().url("validation.tokenUrlInvalid"),
  scope: z.string().max(500).optional(),
  audience: z.string().max(500).optional(),
  tokenRequestFormat: z.enum(["form", "json"]).optional(),
});

export const CreateDataSourceSchema = z.discriminatedUnion("authMethod", [
  tokenCreateFields,
  oauthCreateFields,
]);

// Connection-only fields for a stateless "test before save" probe. No name /
// description — only what is needed to attempt the upstream connection.
const tokenTestFields = z.object({
  type: z.enum(["POSTGREST"]),
  url: z.string().url("validation.urlInvalid"),
  authMethod: z.literal("TOKEN"),
  token: z.string().min(1, "validation.tokenRequired"),
});

const oauthTestFields = z.object({
  type: z.enum(["POSTGREST"]),
  url: z.string().url("validation.urlInvalid"),
  authMethod: z.literal("OAUTH"),
  clientId: z.string().min(1, "validation.clientIdRequired"),
  clientSecret: z.string().min(1, "validation.clientSecretRequired"),
  tokenUrl: z.string().url("validation.tokenUrlInvalid"),
  scope: z.string().max(500).optional(),
  audience: z.string().max(500).optional(),
  tokenRequestFormat: z.enum(["form", "json"]).optional(),
});

export const TestConnectionSchema = z.discriminatedUnion("authMethod", [
  tokenTestFields,
  oauthTestFields,
]);

export const UpdateDataSourceSchema = z.object({
  name: z.string().min(1, "validation.nameRequired").max(100).optional(),
  type: z.enum(["POSTGREST"]).optional(),
  description: z.string().max(500).optional().nullable(),
  url: z.string().url("validation.urlInvalid").optional(),
  authMethod: z.enum(["TOKEN", "OAUTH"]).optional(),
  isActive: z.boolean().optional(),
  // Token auth
  token: z.string().optional(),
  // OAuth auth
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tokenUrl: z.union([z.string().url("validation.tokenUrlInvalid"), z.literal("")]).optional(),
  scope: z.string().max(500).optional().nullable(),
  audience: z.string().max(500).optional().nullable(),
  tokenRequestFormat: z.enum(["form", "json"]).optional(),
});

export type CreateDataSourceInput = z.infer<typeof CreateDataSourceSchema>;
export type UpdateDataSourceInput = z.infer<typeof UpdateDataSourceSchema>;
export type TestConnectionInput = z.infer<typeof TestConnectionSchema>;
