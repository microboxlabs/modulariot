import type { IssuesSearchResponse } from "../types.js";
import { sonarFetch } from "./sonarcloud-client.js";

export interface FetchIssuesParams {
  token: string;
  projectKey: string;
  branch?: string;
  pullRequest?: string;
  severities?: string;
}

export async function fetchIssues(
  params: FetchIssuesParams,
): Promise<IssuesSearchResponse> {
  const query: Record<string, string> = {
    projectKeys: params.projectKey,
    resolved: "false",
    ps: "500",
  };
  if (params.severities) query.severities = params.severities;
  if (params.branch) query.branch = params.branch;
  if (params.pullRequest) query.pullRequest = params.pullRequest;

  return sonarFetch<IssuesSearchResponse>("issues/search", query, params.token);
}
