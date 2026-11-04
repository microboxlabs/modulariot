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
  mutate: vi.fn(),
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  createContact: api.createContact,
  contactsKey: "contacts",
  useContacts: () => ({ data: [], error: undefined, isLoading: false }),
  useSymptomTreatments: () => ({ data: undefined }),
  useTripContacts: () => ({ data: undefined, mutate: api.mutate }),
}));

vi.mock("@/features/symptoms/maintainer/maintainer-api", () => ({
  useLevelResponse: () => ({ data: undefined }),
}));

vi.mock("swr", () => ({ mutate: api.mutate }));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const dict = es as unknown as I18nRecord;
const PHONE = "Número de teléfono";
const NAME = "Nombre";

describe("canSubmitNewNumber", () => {
  it("needs a valid phone to call, and also a name to save", () => {
    expect(canSubmitNewNumber({ phone: "123", name: "Ana" }, "call")).toBe(
      false
    );
    expect(
      canSubmitNewNumber({ phone: "+1 202 555 0101", name: "" }, "call")
    ).toBe(true);
    expect(
      canSubmitNewNumber({ phone: "+1 202 555 0101", name: "" }, "callAndSave")
    ).toBe(false);
    expect(
      canSubmitNewNumber(
        { phone: "+1 202 555 0101", name: "Ana" },
        "callAndSave"
      )
    ).toBe(true);
  });
});

describe("draftFromQuery", () => {
  it("puts a number in the phone field and anything else in the name", () => {
    expect(draftFromQuery(" +1 202 555 0101 ")).toEqual({
      phone: "+12025550101",
      name: "",
    });
    expect(draftFromQuery("+1 202 555 0102").phone).toBe("+12025550102");
    expect(draftFromQuery("Pedro")).toEqual({ phone: "", name: "Pedro" });
  });
});

describe("CallCenterMenu — new number", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createContact.mockImplementation(
      async (body: { name: string; phone: string }) => ({
        ...body,
        id: "api-contact-1",
        role: null,
        methods: ["PHONE", "WHATSAPP"],
        provisional: true,
      })
    );
  });

  function renderMenu() {
    const onCall = vi.fn();
    render(
      <CallCenterMenu
        dict={dict}
        treatmentData={null}
        startedAt={Date.now()}
        skippedTo={null}
        onSkip={vi.fn()}
        onCall={onCall}
      />
    );
    return onCall;
  }

  async function openPanel(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  }

  it("asks for the phone first, then the name", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openPanel(user);
    const phone = screen.getByLabelText(PHONE);
    const name = screen.getByLabelText(NAME);
    expect(
      phone.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("just calls, without touching the contact book", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu();
    await openPanel(user);
    expect(screen.getByRole("button", { name: "Solo llamar" })).toBeDisabled();
    await user.click(screen.getByLabelText(PHONE));
    await user.paste("+12025550101");
    await user.type(screen.getByLabelText(NAME), "Pedro");
    await user.click(screen.getByRole("button", { name: "Solo llamar" }));

    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        personName: "Pedro",
        phone: "+12025550101",
        contactId: undefined,
        methods: ["phone", "whatsapp"],
      })
    );
    expect(api.createContact).not.toHaveBeenCalled();
  });

  it("calls and saves to the contact book", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu();
    await openPanel(user);
    await user.click(screen.getByLabelText(PHONE));
    await user.paste("+12025550101");
    expect(
      screen.getByRole("button", { name: "Llamar y guardar en la libreta" })
    ).toBeDisabled();
    await user.type(screen.getByLabelText(NAME), "Ana Soto");
    await user.click(
      screen.getByRole("button", { name: "Llamar y guardar en la libreta" })
    );

    expect(api.createContact).toHaveBeenCalledWith({
      name: "Ana Soto",
      phone: "+12025550101",
      methods: ["PHONE", "WHATSAPP"],
      channels: { phone: "+12025550101", whatsapp: "+12025550101" },
      provisional: true,
    });
    await waitFor(() =>
      expect(onCall).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "api-contact-1",
          contactId: "api-contact-1",
          personName: "Ana Soto",
          phone: "+12025550101",
          methods: ["phone", "whatsapp"],
        })
      )
    );
    expect(api.mutate).toHaveBeenCalledWith("contacts");
  });

  it("still calls when saving to the book fails, and tells the operator", async () => {
    api.createContact.mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    const onCall = renderMenu();
    await openPanel(user);
    await user.click(screen.getByLabelText(PHONE));
    await user.paste("+12025550103");
    await user.type(screen.getByLabelText(NAME), "Persona Nueva");
    await user.click(
      screen.getByRole("button", { name: "Llamar y guardar en la libreta" })
    );

    await waitFor(() =>
      expect(ShowNotification).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.call_center_new_save_error,
      })
    );
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        personName: "Persona Nueva",
        contactId: undefined,
        methods: ["phone", "whatsapp"],
      })
    );
  });

  it("hides the search bar while adding, keeping the header", async () => {
    const user = userEvent.setup();
    renderMenu();
    const search = screen.getByPlaceholderText(/Buscar en la libreta/);
    expect(search.closest(".hidden")).toBeNull();
    await openPanel(user);
    expect(search.closest(".hidden")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "A quién llamar" })
    ).toBeInTheDocument();
  });

  it("offers to add what was searched, pre-filling the name", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.type(
      screen.getByPlaceholderText(/Buscar en la libreta/),
      "Pedro Pérez"
    );
    await user.click(
      screen.getByRole("button", { name: "Agregar «Pedro Pérez»" })
    );
    expect(screen.getByLabelText(NAME)).toHaveValue("Pedro Pérez");
  });

  it("offers to add a searched number, pre-filling the phone", async () => {
    const user = userEvent.setup();
    const onCall = renderMenu();
    await user.type(
      screen.getByPlaceholderText(/Buscar en la libreta/),
      "+12025550101"
    );
    await user.click(
      screen.getByRole("button", { name: "Agregar «+12025550101»" })
    );
    await user.click(screen.getByRole("button", { name: "Solo llamar" }));
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        personName: "+12025550101",
        phone: "+12025550101",
      })
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
