import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MailTemplateEditor from "./mail-template-editor";
import type { MailTemplate } from "./mail-template-model";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const URL = "/app/api/mail-templates/invitation/es";

const dict = {
  title: "Invitation email",
  organizationDescription: "Email that invited people receive.",
  lang_es: "Español",
  lang_en: "English",
  subject: "Subject",
  body: "Body",
  variables: "Variables",
  preview: "Preview",
  previewSubject: "Subject:",
  sourceOwn: "Customized",
  sourcePlatform: "Platform template",
  sourceDefault: "ModularIoT template",
  save: "Save",
  saved: "Saved",
  discard: "Discard",
  reset: "Reset",
  resetTitle: "Reset?",
  resetBodyOrganization: "Back to the platform template.",
  updated: "Updated by {by}",
};

function template(
  source: MailTemplate["source"],
  subject = "Te invitaron a {{organization}}"
): MailTemplate {
  return {
    kind: "invitation",
    lang: "es",
    source,
    subject,
    html: "<p>{{link}}</p>",
    updatedAt: source === "ORGANIZATION" ? "2026-10-06T12:00:00Z" : null,
    updatedBy: source === "ORGANIZATION" ? "owner@acme.test" : null,
    variables: ["organization", "link"],
  };
}

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const fetchMock = vi.fn();

function calls(method: string, url: string) {
  return fetchMock.mock.calls.filter(
    ([u, init]) => u === url && (init?.method ?? "GET") === method
  );
}

function renderEditor() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MailTemplateEditor scope="organization" dict={dict} lang="es" />
    </SWRConfig>
  );
}

beforeEach(() => {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "POST") {
      return json({ subject: "Te invitaron a Acme", html: "<p>ok</p>" });
    }
    if (method === "PUT") {
      const body = JSON.parse(String(init?.body)) as { subject: string };
      return json(template("ORGANIZATION", body.subject));
    }
    return json(template("PLATFORM"));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("MailTemplateEditor", () => {
  it("shows the inherited template and renders one preview", async () => {
    renderEditor();

    expect(await screen.findByText("Platform template")).toBeInTheDocument();
    expect(await screen.findByText("Te invitaron a Acme")).toBeInTheDocument();
    // Nothing of its own to reset yet.
    expect(screen.queryByText("Reset")).not.toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(calls("POST", `${URL}/preview`)).toHaveLength(1);
  });

  it("saves an edit as the organization's own template", async () => {
    renderEditor();
    const subject = await screen.findByLabelText("Subject");
    expect(screen.getByText("Save")).toBeDisabled();

    fireEvent.change(subject, { target: { value: "Hola {{organization}}" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(calls("PUT", URL)).toHaveLength(1));
    expect(JSON.parse(String(calls("PUT", URL)[0]?.[1]?.body))).toEqual({
      subject: "Hola {{organization}}",
      html: "<p>{{link}}</p>",
    });
    expect(await screen.findByText("Customized")).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("inserts a variable into the body", async () => {
    renderEditor();
    const body = (await screen.findByLabelText("Body")) as HTMLTextAreaElement;
    body.setSelectionRange(0, 0);

    fireEvent.click(screen.getByText("{{organization}}"));

    expect(body.value).toBe("{{organization}}<p>{{link}}</p>");
  });
});
