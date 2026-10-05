import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import ContactBookPageContent from "./contact-book-page-content";

const book = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));
vi.mock("@/features/common/components/Breadcrumb/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));
vi.mock("../contact-book/contact-form-modal", () => ({ default: () => null }));
vi.mock("../contact-book/import-contacts-modal", () => ({
  default: () => null,
}));
vi.mock("../contact-book/taxonomy-store", () => ({
  useContactBadges: () => ({ badges: [] }),
}));
vi.mock("../contact-book/store", () => ({
  useContactBook: () => ({
    contacts: [
      { id: "c1", name: "Persona Ejemplo", phone: "", role: "", methods: [] },
    ],
    hydrated: true,
    error: undefined,
    save: vi.fn(),
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
  beforeEach(() => vi.clearAllMocks());

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
