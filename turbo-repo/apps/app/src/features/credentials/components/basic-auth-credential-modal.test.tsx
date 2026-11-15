import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { CredentialListItem } from "../credential.types";
import { BasicAuthCredentialModal } from "./basic-auth-credential-modal";

const dict = en.pages.userSettings.credentials;

const EDITING: CredentialListItem = {
  id: "demo-credential",
  name: "Document service",
  typeId: "BASIC_AUTH",
  environment: "QA",
  summary: "service-user",
  usedBy: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: "demo-user",
  config: { username: "service-user" },
};

function setup(editing: CredentialListItem | null = null) {
  const props = {
    show: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onTest: vi.fn(),
    editing,
    dict,
  };
  render(<BasicAuthCredentialModal {...props} />);
  return props;
}

const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const submit = () =>
  fireEvent.click(
    screen.getByRole("button", { name: dict.modal.createButton })
  );

describe("BasicAuthCredentialModal", () => {
  it("submits the name, environment, username and password", async () => {
    const props = setup();
    type(dict.modal.name, "Document service");
    type(dict.modal.username, "service-user");
    type(dict.modal.password, "demo-password");
    submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit.mock.calls[0][0]).toEqual({
      name: "Document service",
      environment: "DEVELOPMENT",
      username: "service-user",
      password: "demo-password",
    });
  });

  it("masks the password field", () => {
    setup();
    expect(field(dict.modal.password)).toHaveAttribute("type", "password");
  });

  it("requires a username and a password on create", async () => {
    const props = setup();
    type(dict.modal.name, "Document service");
    submit();
    expect(
      await screen.findByText(dict.validation.usernameRequired)
    ).toBeInTheDocument();
    expect(
      screen.getByText(dict.validation.passwordRequired)
    ).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("prefills the username but never the password when editing", async () => {
    setup(EDITING);
    await waitFor(() =>
      expect(field(dict.modal.username)).toHaveValue("service-user")
    );
    expect(field(dict.modal.password)).toHaveValue("");
    expect(field(dict.modal.password)).toHaveAttribute(
      "placeholder",
      dict.modal.passwordEditPlaceholder
    );
  });

  it("saves an edit with a blank password so the stored one is kept", async () => {
    const props = setup(EDITING);
    await waitFor(() =>
      expect(field(dict.modal.username)).toHaveValue("service-user")
    );
    type(dict.modal.username, "other-user");
    fireEvent.click(
      screen.getByRole("button", { name: dict.modal.saveButton })
    );
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit.mock.calls[0][0]).toMatchObject({
      username: "other-user",
      password: "",
    });
  });

  it("offers no connection test", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: dict.modal.testConnection })
    ).not.toBeInTheDocument();
  });
});
