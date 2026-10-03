import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import CallCenterMenu from "./call-center-menu";
import { canSubmitNewNumber, draftFromQuery } from "./new-number-panel";

const api = vi.hoisted(() => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  importContacts: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  createContact: api.createContact,
  updateContact: api.updateContact,
  deleteContact: api.deleteContact,
  importContacts: api.importContacts,
  useContacts: () => ({ data: [], error: undefined, mutate: api.mutate }),
}));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const dict = es as unknown as I18nRecord;
const PHONE = "Número de teléfono";
const NAME = "Nombre";

describe("canSubmitNewNumber", () => {
  it("needs a valid phone to call, and also a name to save", () => {
    expect(canSubmitNewNumber({ phone: "123", name: "Ana" }, "call")).toBe(false);
    expect(canSubmitNewNumber({ phone: "+56 9 1234 5678", name: "" }, "call")).toBe(true);
    expect(canSubmitNewNumber({ phone: "+56 9 1234 5678", name: "" }, "callAndSave")).toBe(false);
    expect(canSubmitNewNumber({ phone: "+56 9 1234 5678", name: "Ana" }, "callAndSave")).toBe(true);
  });
});

describe("draftFromQuery", () => {
  it("puts a number in the phone field and anything else in the name", () => {
    expect(draftFromQuery(" 9 1234 5678 ")).toEqual({ phone: "+56912345678", name: "" });
    expect(draftFromQuery("+54 9 11 2345 6789").phone).toBe("+5491123456789");
    expect(draftFromQuery("Pedro")).toEqual({ phone: "", name: "Pedro" });
  });
});

describe("CallCenterMenu — new number", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    api.createContact.mockImplementation(async (body: { name: string }) => ({
      ...body,
      id: "api-contact-1",
      methods: ["PHONE", "WHATSAPP"],
      provisional: true,
    }));
  });

  function renderMenu() {
    const onCall = vi.fn();
    render(<CallCenterMenu dict={dict} treatmentData={null} onCall={onCall} />);
    return onCall;
  }

  /** Opens the form the only way there is now: search, then "Agregar «…»"
   *  (a name, so the phone field starts empty). */
  async function openPanel(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByPlaceholderText(/Buscar en la libreta/), "x");
    await user.click(screen.getByRole("button", { name: "Agregar «x»" }));
    await user.clear(screen.getByLabelText(NAME));
    expect(screen.queryByRole("dialog")).toBeNull();
  }

  it("asks for the phone first, then the name", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openPanel(user);
    const phone = screen.getByLabelText(PHONE);
    const name = screen.getByLabelText(NAME);
    expect(phone.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Sin configurar")).toBeNull();
  });

  it("just calls: joins the list without touching the contact book", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu();
    await openPanel(user);
    expect(screen.getByRole("button", { name: "Solo llamar" })).toBeDisabled();
    await user.type(screen.getByLabelText(PHONE), "912345678");
    await user.type(screen.getByLabelText(NAME), "Pedro");
    await user.click(screen.getByRole("button", { name: "Solo llamar" }));

    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Pedro" }),
      "+56 9 1234 5678",
      "Pedro",
      "",
      undefined
    );
    expect(api.createContact).not.toHaveBeenCalled();
    const roles = JSON.parse(window.localStorage.getItem("miot.prototype.call-roles.v1") ?? "[]");
    expect(roles.some((r: { name: string }) => r.name === "Pedro")).toBe(true);
  });

  it("calls and saves to the contact book", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu();
    await openPanel(user);
    await user.type(screen.getByLabelText(PHONE), "912345678");
    expect(screen.getByRole("button", { name: "Llamar y guardar en la libreta" })).toBeDisabled();
    await user.type(screen.getByLabelText(NAME), "Ana Soto");
    await user.click(screen.getByRole("button", { name: "Llamar y guardar en la libreta" }));

    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Soto" }),
      "+56 9 1234 5678",
      "Ana Soto",
      "",
      ["phone", "whatsapp"]
    );
    expect(api.createContact).toHaveBeenCalledTimes(1);
    expect(api.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana Soto",
        phone: "+56912345678",
        methods: ["PHONE", "WHATSAPP"],
        channels: { phone: "+56912345678", whatsapp: "+56912345678" },
        provisional: true,
      })
    );
    await waitFor(() => {
      const details = JSON.parse(window.localStorage.getItem("miot.prototype.contact-details.v1") ?? "{}");
      expect(Object.values(details)).toContainEqual({ bookId: "api-contact-1" });
    });
    expect(window.localStorage.getItem("miot.prototype.contact-book.v1")).toBeNull();
  });

  it("still calls when saving to the book fails, and tells the operator", async () => {
    api.createContact.mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    const onCall = renderMenu();
    await openPanel(user);
    await user.type(screen.getByLabelText(PHONE), "900000001");
    await user.type(screen.getByLabelText(NAME), "Persona Nueva");
    await user.click(screen.getByRole("button", { name: "Llamar y guardar en la libreta" }));

    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Persona Nueva" }),
      expect.any(String),
      "Persona Nueva",
      "",
      ["phone", "whatsapp"]
    );
    await waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.call_center_new_save_error,
      })
    );
    const details = JSON.parse(window.localStorage.getItem("miot.prototype.contact-details.v1") ?? "{}");
    expect(Object.values(details)).toContainEqual({
      phone: "+56900000001",
      methods: ["phone", "whatsapp"],
    });
  });

  it("has no add button next to the search bar", () => {
    renderMenu();
    expect(screen.queryByRole("button", { name: "Agregar contacto" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Agregar «/ })).toBeNull();
  });

  it("hides the search bar while adding, keeping the header", async () => {
    const user = userEvent.setup();
    renderMenu();
    expect(screen.getByPlaceholderText(/Buscar en la libreta/)).toBeInTheDocument();
    await openPanel(user);
    expect(screen.queryByPlaceholderText(/Buscar en la libreta/)).toBeNull();
    expect(screen.getByRole("heading", { name: "A quién llamar" })).toBeInTheDocument();
  });

  it("offers to add what was searched, pre-filling the name", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.type(screen.getByPlaceholderText(/Buscar en la libreta/), "Pedro Pérez");
    await user.click(screen.getByRole("button", { name: "Agregar «Pedro Pérez»" }));
    expect(screen.getByLabelText(NAME)).toHaveValue("Pedro Pérez");
  });

  it("offers to add a searched number, pre-filling the phone", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu();
    await user.type(screen.getByPlaceholderText(/Buscar en la libreta/), "912345678");
    await user.click(screen.getByRole("button", { name: "Agregar «912345678»" }));
    await user.click(screen.getByRole("button", { name: "Solo llamar" }));
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "+56 9 1234 5678" }),
      "+56 9 1234 5678",
      "+56 9 1234 5678",
      "",
      undefined
    );
  });

  it("goes back to the list", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Volver a la lista" }));
    expect(screen.queryByLabelText(PHONE)).toBeNull();
  });
});
