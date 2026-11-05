import { describe, expect, it } from "vitest";
import { parseServiceAccountKeyFile } from "./service-account-key-file";

const KEY = {
  type: "service_account",
  project_id: "acme-analytics",
  private_key_id: "abc",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIfake\n-----END PRIVATE KEY-----\n",
  client_email: "dashboards@acme-analytics.iam.gserviceaccount.com",
  client_id: "1",
};

describe("parseServiceAccountKeyFile", () => {
  it("takes the project, email and private key from a key file", () => {
    expect(parseServiceAccountKeyFile(JSON.stringify(KEY))).toEqual({
      projectId: "acme-analytics",
      clientEmail: "dashboards@acme-analytics.iam.gserviceaccount.com",
      privateKey: KEY.private_key,
    });
  });

  it("rejects text that is not a service account key", () => {
    expect(parseServiceAccountKeyFile("not json")).toBeNull();
    expect(
      parseServiceAccountKeyFile(
        JSON.stringify({ ...KEY, type: "authorized_user" })
      )
    ).toBeNull();
    expect(
      parseServiceAccountKeyFile(JSON.stringify({ ...KEY, private_key: "" }))
    ).toBeNull();
  });
});
