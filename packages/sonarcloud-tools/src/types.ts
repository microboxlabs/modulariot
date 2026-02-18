export interface SonarCloudError {
  msg: string;
}

export interface SonarCloudErrorResponse {
  errors: SonarCloudError[];
}

export interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
  type: string;
  status: string;
}

export interface IssuesSearchResponse {
  total: number;
  issues: SonarIssue[];
}

export interface SonarRule {
  key: string;
  name: string;
  severity?: string;
  type?: string;
  htmlDesc?: string;
  mdDesc?: string;
  description?: string;
}

export interface RuleShowResponse {
  rule: SonarRule;
}

export interface IssuesOptions {
  token: string;
  projectKey: string;
  branch?: string;
  pullRequest?: string;
  severities?: string;
  output: "list" | "context";
  withDocs?: boolean;
}

export interface RuleDocOptions {
  token: string;
  organization: string;
  ruleKey: string;
  output: "text" | "md" | "json" | "url";
}
