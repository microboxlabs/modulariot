import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import type { BookContact } from "../contact-book/store";
import { toContactBody } from "../contact-book/store";
import { readBadges } from "../contact-book/taxonomy-store";
import ContactBookPageContent from "./contact-book-page-content";

const book = vi.hoisted(() => ({
  remove: vi.fn(),
  save: vi.fn(),
  getContact: vi.fn(),
}));

vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (original) => ({
    ...(await original<
      typeof import("@/features/symptoms/control-tower/control-tower-api")
    >()),
    controlTowerRequest: book.getContact,
  })
);

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));
vi.mock("@/features/common/components/Breadcrumb/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));
vi.mock("../contact-book/contact-form-modal", () => ({
  default: ({
    show,
    editing,
    onSave,
  }: {
    show: boolean;
    editing: BookContact | null;
    onSave: (contact: BookContact) => void;
  }) =>
    show && editing ? (
      <button onClick={() => onSave(editing)}>Save linked contact</button>
    ) : null,
}));
vi.mock("../contact-book/import-contacts-modal", () => ({
  default: () => null,
}));
vi.mock("../contact-book/store", async (original) => ({
  ...(await original<typeof import("../contact-book/store")>()),
  bookCompanies: () => [],
  useContactBookPages: () => ({
    contacts: [
      { id: "c1", name: "Persona Ejemplo", phone: "", role: "", methods: [] },
    ],
    facets: undefined,
    hydrated: true,
    error: undefined,
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    save: book.save,
    addMany: vi.fn(),
    remove: book.remove,
    renameTag: vi.fn(),
    deleteTag: vi.fn(),
  }),
}));

const dict = es.pages.userSettings as unknown as I18nRecord;

async function deleteFirstContact() {
  const user = userEvent.setup();
  render(<ContactBookPageContent dict={dict} lang="es" />);
  await user.click(screen.getByRole("button", { name: "Acciones" }));
  await user.click(screen.getByText("Eliminar contacto"));
}

describe("ContactBookPageContent — delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("preserves a linked contact's tags before local badges have loaded", async () => {
    window.history.replaceState({}, "", "/?edit=linked-contact");
    book.getContact.mockResolvedValue({
      id: "linked-contact",
      name: "Synthetic contact",
      methods: [],
      tags: ["Night shift"],
    });
    const user = userEvent.setup();
    render(<ContactBookPageContent dict={dict} lang="es" />);
    await user.click(
      await screen.findByRole("button", { name: "Save linked contact" })
    );
    const contact = book.save.mock.calls[0]?.[0] as BookContact;
    expect(toContactBody(contact, readBadges()).tags).toEqual(["Night shift"]);
  });

  it("says only an owner can delete when the API answers 403", async () => {
    book.remove.mockRejectedValue(new ControlTowerError("forbidden", 403));
    await deleteFirstContact();
    await vi.waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: es.pages.userSettings.contactBook.removeError,
      })
    );
  });

  it("gives a plain error for any other failure", async () => {
    book.remove.mockRejectedValue(new ControlTowerError("HTTP 500", 500));
    await deleteFirstContact();
    await vi.waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: "No se pudo eliminar el contacto.",
      })
    );
  });
});
