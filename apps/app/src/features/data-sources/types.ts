import { z } from "zod";

export interface DataSourceListItem {
  id: string;
  name: string;
  type: "POSTGREST";
  description?: string;
  siteId: string;
  connectionConfig: {
    url: string;
    maskedToken: string;
  };
  isActive: boolean;
  lastTestedAt?: string;
  lastTestResult?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceFormData {
  name: string;
  type: "POSTGREST";
  description?: string;
  url: string;
  token: string;
}

export const CreateDataSourceSchema = z.object({
  name: z.string().min(1, "validation.nameRequired").max(100),
  type: z.enum(["POSTGREST"]),
  description: z.string().max(500).optional(),
  url: z.string().url("validation.urlInvalid"),
  token: z.string().min(1, "validation.tokenRequired"),
});

export const UpdateDataSourceSchema = z.object({
  name: z.string().min(1, "validation.nameRequired").max(100).optional(),
  type: z.enum(["POSTGREST"]).optional(),
  description: z.string().max(500).optional().nullable(),
  url: z.string().url("validation.urlInvalid").optional(),
  token: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateDataSourceInput = z.infer<typeof CreateDataSourceSchema>;
export type UpdateDataSourceInput = z.infer<typeof UpdateDataSourceSchema>;
