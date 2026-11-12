import { z } from "zod";

/** Optional on legacy rows; engine treatment data is checked at the API boundary. */
export const treatmentFieldsSchema = z.object({
  treatment_state: z.enum(["untreated", "in_treatment", "treated"]).nullish(),
  treatment: z
    .object({
      id: z.string(),
      status: z.enum(["OPEN", "CLOSED"]),
      type: z.string().nullish(),
      outcome: z.enum(["call", "handling", "ignore", "invalidate"]).nullish(),
      outcome_label: z.string().nullish(),
      resolution: z.string().nullish(),
      opened_by: z.string().nullish(),
      opened_at: z.string().nullish(),
      closed_by: z.string().nullish(),
      closed_at: z.string().nullish(),
      mine: z.boolean().optional(),
      operators: z.array(z.string()).optional(),
    })
    .nullish(),
});
