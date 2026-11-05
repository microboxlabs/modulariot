import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function draftProps() {
  return {
    show: true,
    connection: undefined,
    template: undefined,
    providerType: "BIGQUERY" as const,
    credentials: [google],
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ id: "demo-created" }),
    onTestDraft: vi.fn().mockResolvedValue({
      success: true,
      testedAt: "2026-01-01T00:00:00Z",
      message: "Demo success",
    }),
    onTest: vi.fn().mockResolvedValue({
      success: true,
      testedAt: "2026-01-01T00:00:00Z",
      message: "Demo saved",
    }),
    saving: false,
    dict,
  };
}
function fillDraft() {
  fireEvent.change(screen.getByLabelText(dict.connection.form.name), {
    target: { value: "Demo BigQuery" },
  });
  fireEvent.change(screen.getByLabelText(dict.connection.form.credential), {
    target: { value: google.id },
  });
}

describe("draft connection testing lifecycle", () => {
  it("tests without saving and records a successful draft after creation", async () => {
    const props = draftProps();
    render(<ConnectionFormModal {...props} />);
    fillDraft();
    fireEvent.click(
      screen.getByRole("button", { name: dict.connections.test })
    );
    await screen.findByText(/Demo success/);
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    await waitFor(() =>
      expect(props.onTest).toHaveBeenCalledWith("demo-created")
    );
  });
  it("ignores the result from a previous open session", async () => {
    const work = pending<{
      success: boolean;
      testedAt: string;
      message: string;
    }>();
    const props = draftProps();
    props.onTestDraft.mockReturnValue(work.promise);
    const view = render(<ConnectionFormModal {...props} />);
    fillDraft();
    fireEvent.click(
      screen.getByRole("button", { name: dict.connections.test })
    );
    await waitFor(() => expect(props.onTestDraft).toHaveBeenCalledOnce());
    view.rerender(<ConnectionFormModal {...props} show={false} />);
    view.rerender(<ConnectionFormModal {...props} />);
    await act(async () =>
      work.resolve({
        success: true,
        testedAt: "2026-01-01T00:00:00Z",
        message: "Stale result",
      })
    );
    expect(screen.queryByText(/Stale result/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: dict.connections.test })
    ).toBeEnabled();
  });
  it("locks the tested values and prevents saving during the draft check", async () => {
    const work = pending<{
      success: boolean;
      testedAt: string;
      message: string;
    }>();
    const props = draftProps();
    props.onTestDraft.mockReturnValue(work.promise);
    render(<ConnectionFormModal {...props} />);
    fillDraft();
    fireEvent.click(
      screen.getByRole("button", { name: dict.connections.test })
    );
    await waitFor(() => expect(props.onTestDraft).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(dict.connection.form.name)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: dict.common.create })
    ).toBeDisabled();
    await act(async () =>
      work.resolve({
        success: true,
        testedAt: "2026-01-01T00:00:00Z",
        message: "Demo success",
      })
    );
  });
  it("closes the original form before recording the saved test and cannot close a later session", async () => {
    const work = pending<{
      success: boolean;
      testedAt: string;
      message: string;
    }>();
    const props = draftProps();
    props.onTest.mockReturnValue(work.promise);
    const view = render(<ConnectionFormModal {...props} />);
    fillDraft();
    fireEvent.click(
      screen.getByRole("button", { name: dict.connections.test })
    );
    await screen.findByText(/Demo success/);
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    await waitFor(() => expect(props.onTest).toHaveBeenCalledOnce());
    expect(props.onClose).toHaveBeenCalledOnce();
    view.rerender(<ConnectionFormModal {...props} show={false} />);
    view.rerender(<ConnectionFormModal {...props} />);
    await act(async () =>
      work.resolve({
        success: true,
        testedAt: "2026-01-01T00:00:00Z",
        message: "Demo saved",
      })
    );
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});

describe("draft replay eligibility", () => {
  it("does not replay a native PostgREST description check before functions exist", async () => {
    const props = { ...draftProps(), providerType: "POSTGREST" as const };
    render(<ConnectionFormModal {...props} />);
    fillDraft();
    fireEvent.change(screen.getByLabelText(dict.connection.form.baseUrl), {
      target: { value: "https://data.example.invalid" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dict.connections.test })
    );
    await screen.findByText(/Demo success/);
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(props.onTest).not.toHaveBeenCalled();
  });
  it("does not replay when the saved values differ from the successful draft", async () => {
    const props = draftProps();
    render(<ConnectionFormModal {...props} />);
    fillDraft();
    fireEvent.click(
      screen.getByRole("button", { name: dict.connections.test })
    );
    await screen.findByText(/Demo success/);
    fireEvent.change(screen.getByLabelText(dict.connection.form.name), {
      target: { value: "Demo changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: dict.common.create }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(props.onTest).not.toHaveBeenCalled();
  });
});
