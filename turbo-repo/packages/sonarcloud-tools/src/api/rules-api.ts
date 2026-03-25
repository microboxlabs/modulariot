import type { RuleShowResponse } from "../types.js";
import { sonarFetch } from "./sonarcloud-client.js";

export interface FetchRuleParams {
  token: string;
  ruleKey: string;
  organization: string;
}

export async function fetchRule(
  params: FetchRuleParams,
): Promise<RuleShowResponse> {
  return sonarFetch<RuleShowResponse>(
    "rules/show",
    {
      key: params.ruleKey,
      organization: params.organization,
    },
    params.token,
  );
}
