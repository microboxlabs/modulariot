import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { CredentialListItem } from "../credential.types";
import { GoogleServiceAccountCredentialModal } from "./google-service-account-credential-modal";

const KEY = {
  type: "service_account",
  project_id: "example-project",
  client_email: "demo@example.invalid",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nFAKE-KEY\n-----END PRIVATE KEY-----",
};

function keyFile(
  name: string,
  contents = JSON.stringify(KEY),
  read?: Promise<string>
) {
  const file = new File([contents], name, { type: "application/json" });
  // jsdom's File does not implement the browser's Blob.text method.
  Object.defineProperty(file, "text", {
    value: () => read ?? Promise.resolve(contents),
  });
  return file;
}

function deferredText() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup() {
  const props = {
    show: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onTest: vi.fn().mockResolvedValue({ success: true, message: "" }),
    dict: en.pages.userSettings.credentials,
  };
  return {
    ...render(<GoogleServiceAccountCredentialModal {...props} />),
    props,
  };
}

function select(file: File) {
  fireEvent.change(screen.getByTestId("gsa-key-file"), {
    target: { files: [file] },
  });
}

describe("Google service account key loading", () => {
  it.each(["input", "drop"])(
    "fills the credential fields through %s",
    async (method) => {
      setup();
      const file = keyFile("demo.json");
      if (method === "drop") {
        fireEvent.drop(screen.getByTestId("gsa-key-file").parentElement!, {
          dataTransfer: { files: [file] },
        });
      } else {
        select(file);
      }
      await waitFor(() =>
        expect(screen.getByLabelText("Project ID")).toHaveValue(KEY.project_id)
      );
      expect(screen.getByLabelText("Service account email")).toHaveValue(
        KEY.client_email
      );
      expect(screen.getByLabelText("Private key")).toHaveValue(KEY.private_key);
      expect(
        screen.getByLabelText(en.pages.userSettings.credentials.modal.name)
      ).toHaveValue("demo");
      expect(
        screen.getByText("Fields filled in from demo.json.")
      ).toBeInTheDocument();
    }
  );

  it("preserves a name entered before loading a key", async () => {
    setup();
    fireEvent.change(
      screen.getByLabelText(en.pages.userSettings.credentials.modal.name),
      { target: { value: "Custom label" } }
    );
    select(keyFile("demo.json"));
    await screen.findByText("Fields filled in from demo.json.");
    expect(
      screen.getByLabelText(en.pages.userSettings.credentials.modal.name)
    ).toHaveValue("Custom label");
  });

  it("keeps the newest selection when an older read finishes last", async () => {
    setup();
    const old = deferredText();
    select(keyFile("old.json", undefined, old.promise));
    const latest = {
      ...KEY,
      project_id: "latest-project",
      client_email: "latest@example.invalid",
    };
    select(keyFile("latest.json", JSON.stringify(latest)));
    await screen.findByText("Fields filled in from latest.json.");
    await act(async () => old.resolve(JSON.stringify(KEY)));
    expect(screen.getByLabelText("Project ID")).toHaveValue(latest.project_id);
    expect(screen.getByLabelText("Service account email")).toHaveValue(
      latest.client_email
    );
    expect(
      screen.getByText("Fields filled in from latest.json.")
    ).toBeInTheDocument();
  });

  it("reports a rejected read without changing credential fields", async () => {
    setup();
    select(
      keyFile(
        "unreadable.json",
        undefined,
        Promise.reject(new Error("Synthetic read failure"))
      )
    );
    expect(
      await screen.findByText("This is not a Google service account key file.")
    ).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Project ID")).toHaveValue("");
  });

  it("ignores a stale rejection after a newer key has loaded", async () => {
    setup();
    const old = deferredText();
    select(keyFile("old.json", undefined, old.promise));
    select(keyFile("latest.json"));
    await screen.findByText("Fields filled in from latest.json.");
    await act(async () => old.reject(new Error("Synthetic read failure")));
    expect(
      screen.queryByText("This is not a Google service account key file.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Fields filled in from latest.json.")
    ).toBeInTheDocument();
  });

  it("discards a pending read across closing and reopening the form", async () => {
    const view = setup();
    const old = deferredText();
    select(keyFile("old.json", undefined, old.promise));
    view.rerender(
      <GoogleServiceAccountCredentialModal {...view.props} show={false} />
    );
    view.rerender(<GoogleServiceAccountCredentialModal {...view.props} show />);
    await act(async () => old.resolve(JSON.stringify(KEY)));
    expect(screen.getByLabelText("Project ID")).toHaveValue("");
    expect(screen.getByLabelText("Private key")).toHaveValue("");
    expect(
      screen.queryByText("Fields filled in from old.json.")
    ).not.toBeInTheDocument();
  });

  it("does not populate another credential from a previous pending read", async () => {
    const view = setup();
    const old = deferredText();
    select(keyFile("old.json", undefined, old.promise));
    const editing: CredentialListItem = {
      id: "demo-credential",
      name: "Another credential",
      typeId: "GOOGLE_SERVICE_ACCOUNT",
      environment: "DEVELOPMENT",
      summary: "demo",
      usedBy: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      updatedBy: "demo-user",
      config: {
        projectId: "other-project",
        clientEmail: "other@example.invalid",
      },
    };
    view.rerender(
      <GoogleServiceAccountCredentialModal {...view.props} editing={editing} />
    );
    await act(async () => old.resolve(JSON.stringify(KEY)));
    expect(screen.getByLabelText("Project ID")).toHaveValue("other-project");
    expect(screen.getByLabelText("Service account email")).toHaveValue(
      "other@example.invalid"
    );
    expect(screen.getByLabelText("Private key")).toHaveValue("");
    expect(
      screen.queryByText("Fields filled in from old.json.")
    ).not.toBeInTheDocument();
  });
});
