import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import type { IntegrationConnection } from "../integration-config.types";
import { ConnectionFormModal } from "./connection-form-modal";

const dict = en.pages.integrationConnections;
const google: CredentialListItem = {
  id: "demo-google",
  name: "Demo Google",
  typeId: "GOOGLE_SERVICE_ACCOUNT",
  environment: "DEVELOPMENT",
  summary: "demo",
  config: {},
  usedBy: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: "demo-user",
};
const oauth: CredentialListItem = {
  ...google,
  id: "demo-oauth",
  name: "Demo OAuth",
  typeId: "OAUTH2_CLIENT_CREDENTIALS",
};

function show(connection?: IntegrationConnection) {
  const onSave = vi.fn().mockResolvedValue({});
  render(
    <ConnectionFormModal
      show
      connection={connection}
      template={undefined}
      providerType={connection ? undefined : "BIGQUERY"}
      credentials={[google, oauth]}
      onClose={vi.fn()}
      onSave={onSave}
      saving={false}
      dict={dict}
    />
  );
  return onSave;
}

describe("BigQuery connection credential selection", () => {
  it("uses the fixed API endpoint and saves with a Google credential", async () => {
    const onSave = show();
    expect(screen.getByLabelText(dict.connection.form.baseUrl)).toHaveValue(
      "https://bigquery.googleapis.com"
    );
    expect(screen.getByLabelText(dict.connection.form.baseUrl)).toHaveAttribute(
      "readonly"
    );
    expect(
      screen.getByRole("option", { name: "Demo Google · DEVELOPMENT" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Demo OAuth · DEVELOPMENT" })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(dict.connection.form.name), {
      target: { value: "Demo BigQuery" },
    });
    fireEvent.change(screen.getByLabelText(dict.connection.form.credential), {
      target: { value: google.id },
    });
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Demo BigQuery",
        baseUrl: "https://bigquery.googleapis.com",
        credentialProfileId: google.id,
        providerType: "CUSTOM_HTTP",
      })
    );
  });

  it("does not save without a Google credential", async () => {
    const onSave = show();
    fireEvent.change(screen.getByLabelText(dict.connection.form.name), {
      target: { value: "Demo BigQuery" },
    });
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    expect(
      await screen.findByText(dict.bigquery.credentialRequired)
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not silently retain an unsupported credential when editing", async () => {
    const onSave = show({
      id: "demo-connection",
      name: "Demo BigQuery",
      providerType: "CUSTOM_HTTP",
      baseUrl: "https://bigquery.googleapis.com",
      credentialProfileId: oauth.id,
      status: "ACTIVE",
      lastTestedAt: null,
      lastTestResult: null,
      templateId: null,
      metadata: {},
    });
    fireEvent.click(screen.getByRole("button", { name: dict.common.save }));
    expect(
      await screen.findByText(dict.bigquery.credentialRequired)
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
