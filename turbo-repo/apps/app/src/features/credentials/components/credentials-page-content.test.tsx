import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { CredentialTestResult } from "../credential.types";
import CredentialsPageContent from "./credentials-page-content";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  test: vi.fn(),
  testConfig: vi.fn(),
}));
vi.mock("../use-credentials", () => ({
  useCredentials: () => ({
    credentials: [],
    isLoading: false,
    error: null,
    // Models the revalidation phase after the hook has cleared actionLoading.
    actionLoading: false,
    ...actions,
  }),
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({ activeOrg: { slug: "demo-org" } }),
  })
);
vi.mock("@/features/common/components/settings-page-shell", () => ({
  default: ({
    children,
    actions,
  }: Readonly<PropsWithChildren<{ actions: ReactNode }>>) => (
    <>
      {actions}
      {children}
    </>
  ),
}));
vi.mock("@/features/common/components/layout-toggle", () => ({
  default: () => null,
}));
vi.mock("./credentials-toolbar", () => ({ CredentialsToolbar: () => null }));
vi.mock("./credentials-list", () => ({ CredentialsList: () => null }));
vi.mock("./credential-delete-dialog", () => ({
  CredentialDeleteDialog: () => null,
}));
vi.mock("./auth0-m2m-credential-modal", () => ({
  Auth0M2MCredentialModal: () => null,
}));
vi.mock("./azure-entra-credential-modal", () => ({
  AzureEntraCredentialModal: () => null,
}));
vi.mock("./oauth2-credential-modal", () => ({
  OAuth2CredentialModal: () => null,
}));
vi.mock("./bearer-token-credential-modal", () => ({
  BearerTokenCredentialModal: () => null,
  ResendCredentialModal: () => null,
  WhatsAppCredentialModal: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const dict = en.pages.userSettings.credentials;
const success = { success: true, message: "" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset());
  actions.create.mockResolvedValue({ id: "new-demo" });
  actions.testConfig.mockResolvedValue(success);
  actions.test.mockResolvedValue(success);
});

async function openForm() {
  fireEvent.click(screen.getByRole("button", { name: dict.addButton }));
  fireEvent.click(
    (await screen.findByText(dict.types.googleServiceAccount.name)).closest(
      "button"
    )!
  );
  await screen.findByRole("heading", { name: dict.modal.googleAddTitle });
}

function fill() {
  fireEvent.change(screen.getByLabelText(dict.modal.name), {
    target: { value: "Demo credential" },
  });
  fireEvent.change(screen.getByLabelText("Project ID"), {
    target: { value: "example-project" },
  });
  fireEvent.change(screen.getByLabelText("Service account email"), {
    target: { value: "demo@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Private key"), {
    target: {
      value: "-----BEGIN PRIVATE KEY-----\nFAKE-KEY\n-----END PRIVATE KEY-----",
    },
  });
}

function show() {
  render(
    <CredentialsPageContent
      dict={en.pages.userSettings}
      rootDict={en}
      lang="en"
    />
  );
}

describe("credential save and recorded test lifecycle", () => {
  it.each(["success", "failure"])(
    "does not close a newer form when the saved test ends with %s",
    async (outcome) => {
      show();
      await openForm();
      fill();
      fireEvent.click(
        screen.getByRole("button", { name: dict.modal.testConnection })
      );
      await screen.findByText(dict.modal.testSuccess);
      const test = deferred<CredentialTestResult>();
      actions.test.mockReturnValueOnce(test.promise);
      fireEvent.click(
        screen.getByRole("button", { name: dict.modal.createButton })
      );
      await waitFor(() =>
        expect(actions.test).toHaveBeenCalledWith("new-demo")
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: dict.modal.googleAddTitle })
        ).not.toBeInTheDocument()
      );
      await openForm();
      fireEvent.change(screen.getByLabelText(dict.modal.name), {
        target: { value: "Another unsaved credential" },
      });
      await act(async () => {
        if (outcome === "success") test.resolve(success);
        else test.reject(new Error("Synthetic test failure"));
      });
      expect(
        screen.getByRole("heading", { name: dict.modal.googleAddTitle })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(dict.modal.name)).toHaveValue(
        "Another unsaved credential"
      );
    }
  );

  it("prevents duplicate submits while create revalidation is pending", async () => {
    show();
    await openForm();
    fill();
    const save = deferred<{ id: string }>();
    actions.create.mockReturnValueOnce(save.promise);
    const button = screen.getByRole("button", {
      name: dict.modal.createButton,
    });
    const form = button.closest("form")!;
    fireEvent.click(button);
    await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    fireEvent.submit(form);
    await act(async () => {});
    expect(actions.create).toHaveBeenCalledTimes(1);
    await act(async () => save.resolve({ id: "new-demo" }));
  });

  it("does not record a draft test for changed form values", async () => {
    show();
    await openForm();
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: dict.modal.testConnection })
    );
    await screen.findByText(dict.modal.testSuccess);
    fireEvent.change(screen.getByLabelText(dict.modal.name), {
      target: { value: "Changed name" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dict.modal.createButton })
    );
    await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: dict.modal.googleAddTitle })
      ).not.toBeInTheDocument()
    );
    expect(actions.test).not.toHaveBeenCalled();
  });
});
