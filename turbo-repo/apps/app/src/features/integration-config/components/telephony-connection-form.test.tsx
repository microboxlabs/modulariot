import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import type { IntegrationConnection } from "../integration-config.types";
import { ConnectionFormModal } from "./connection-form-modal";

const dict = en.pages.integrationConnections;
const telnyx: CredentialListItem = {
  id: "demo-telnyx",
  name: "Demo Telnyx",
  typeId: "TELNYX",
  environment: "DEVELOPMENT",
  summary: "demo",
  config: {},
  usedBy: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: "demo-user",
};
const entra: CredentialListItem = {
  ...telnyx,
  id: "demo-entra",
  name: "Demo Entra",
  typeId: "AZURE_ENTRA_CLIENT_CREDENTIALS",
};

function show(
  providerType: "TELNYX" | "TEAMS_PHONE" | undefined,
  connection?: IntegrationConnection
) {
  const onSave = vi.fn().mockResolvedValue({});
  render(
    <ConnectionFormModal
      show
      connection={connection}
      template={undefined}
      providerType={providerType}
      credentials={[telnyx, entra]}
      onClose={vi.fn()}
      onSave={onSave}
      saving={false}
      dict={dict}
    />
  );
  return onSave;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("telephony connections", () => {
  it("clears the optional Teams caller ID while keeping unrelated metadata", async () => {
    const onSave = show(undefined, {
      id: "conn-1",
      name: "Teams",
      providerType: "TEAMS_PHONE",
      baseUrl: "https://graph.microsoft.com",
      credentialProfileId: entra.id,
      status: "ACTIVE",
      lastTestedAt: null,
      lastTestResult: true,
      templateId: null,
      metadata: { note: "kept", defaultCallerId: "+56200000000" },
    });
    type(dict.telephony.defaultCallerId, "");
    fireEvent.click(screen.getByRole("button", { name: dict.common.save }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(null, "conn-1", {
        name: "Teams",
        baseUrl: "https://graph.microsoft.com",
        credentialProfileId: entra.id,
        metadata: { note: "kept" },
      })
    );
  });

  it("creates a Telnyx connection with its SIP id and caller number", async () => {
    const onSave = show("TELNYX");
    expect(screen.getByLabelText(dict.connection.form.baseUrl)).toHaveValue(
      "https://api.telnyx.com"
    );
    expect(
      screen.queryByRole("option", { name: "Demo Entra · DEVELOPMENT" })
    ).not.toBeInTheDocument();
    type(dict.connection.form.name, "Telnyx");
    type(dict.connection.form.credential, telnyx.id);
    type(dict.telephony.sipConnectionId, "sip-1");
    type(dict.telephony.callerNumber, "+56 9 0000 0000");
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Telnyx",
        baseUrl: "https://api.telnyx.com",
        credentialProfileId: telnyx.id,
        metadata: { sipConnectionId: "sip-1", callerNumber: "+56900000000" },
        providerType: "TELNYX",
      })
    );
  });

  it("does not save a Telnyx connection with a bad number", async () => {
    const onSave = show("TELNYX");
    type(dict.connection.form.name, "Telnyx");
    type(dict.connection.form.credential, telnyx.id);
    type(dict.telephony.sipConnectionId, "sip-1");
    type(dict.telephony.callerNumber, "0000");
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    expect(
      await screen.findByText(dict.telephony.callerNumberInvalid)
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("edits a Teams Phone connection and keeps its other metadata", async () => {
    const onSave = show(undefined, {
      id: "conn-1",
      name: "Teams",
      providerType: "TEAMS_PHONE",
      baseUrl: "https://graph.microsoft.com",
      credentialProfileId: entra.id,
      status: "ACTIVE",
      lastTestedAt: null,
      lastTestResult: true,
      templateId: null,
      metadata: { note: "kept" },
    });
    expect(
      screen.queryByRole("option", { name: "Demo Telnyx · DEVELOPMENT" })
    ).not.toBeInTheDocument();
    type(dict.telephony.defaultCallerId, "+56 2 0000 0000");
    fireEvent.click(screen.getByRole("button", { name: dict.common.save }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(null, "conn-1", {
        name: "Teams",
        baseUrl: "https://graph.microsoft.com",
        credentialProfileId: entra.id,
        metadata: { note: "kept", defaultCallerId: "+56200000000" },
      })
    );
  });
});
