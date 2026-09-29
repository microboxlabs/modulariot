import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import ContactFormModal from "./contact-form-modal";
import type { BookContact } from "./store";

vi.mock("@/features/layout/components/secured-navbar/org-switcher/use-org-scopes", () => ({
  useOrgScopes: () => ({ activeOrg: { slug: "mintral", displayName: "Mintral" } }),
}));
vi.mock("../hooks/use-org-members", () => ({
  useOrgMembers: () => ({
    members: [
      { id: "m1", email: "ana@mintral.cl", firstName: "Ana", lastName: "Soto", displayName: "Ana Soto" },
      { id: "m2", email: "rodrigo@mintral.cl", firstName: "Rodrigo", lastName: "Seguel", displayName: "Rodrigo Seguel" },
    ],
    isLoading: false,
    error: null,
  }),
}));

const dict = es.pages.userSettings as unknown as I18nRecord;
const BADGES_KEY = "miot.prototype.contact-badges.v1";

function renderForm(editing: BookContact | null = null) {
  const onSave = vi.fn();
  render(<ContactFormModal show onClose={vi.fn()} editing={editing} onSave={onSave} dict={dict} />);
  return onSave;
}

/** Digits shown in a phone field (formatting varies; jsdom skips some of it). */
const digitsOf = (el: HTMLElement) => (el as HTMLInputElement).value.replace(/\D/g, "");

const saved = (onSave: ReturnType<typeof vi.fn>) => onSave.mock.calls[0]?.[0] as BookContact;

describe("ContactFormModal — persona", () => {
  beforeEach(() => window.localStorage.clear());

  it("lists the organization's people, filters them and saves the picked one", async () => {
    const user = userEvent.setup();
    const onSave = renderForm();
    expect(screen.getByRole("button", { name: /Ana Soto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Buscar por nombre o correo…"), "rodri");
    expect(screen.queryByRole("button", { name: /Ana Soto/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Rodrigo Seguel/ }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(saved(onSave)).toMatchObject({ name: "Rodrigo Seguel", orgMemberId: "m2" });
  });

  it("switches to an outside contact with full name and RUT", async () => {
    const user = userEvent.setup();
    const onSave = renderForm();
    await user.click(screen.getByRole("button", { name: "O ingresa un contacto fuera de la organización" }));
    await user.type(screen.getByLabelText("Nombre completo"), "Pedro Externo");
    await user.type(screen.getByLabelText("RUT"), "12.345.678-0");
    expect(screen.getByText("El RUT no es válido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.clear(screen.getByLabelText("RUT"));
    await user.type(screen.getByLabelText("RUT"), "12.345.678-5");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(saved(onSave)).toMatchObject({ name: "Pedro Externo", rut: "12.345.678-5", orgMemberId: undefined });
  });
});

describe("ContactFormModal — badges", () => {
  beforeEach(() => window.localStorage.clear());

  async function pickAna(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /Ana Soto/ }));
  }

  it("creates badges, reuses existing ones and saves them as descriptors", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(BADGES_KEY, JSON.stringify([{ id: "b1", name: "Mintral" }]));
    const onSave = renderForm();
    await pickAna(user);
    const input = screen.getByPlaceholderText(/Busca o crea una etiqueta/);
    await user.type(input, "transportista{Enter}");
    await user.type(input, "mintral{Enter}");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const badges = JSON.parse(window.localStorage.getItem(BADGES_KEY) ?? "[]");
    expect(badges.map((b: { name: string }) => b.name)).toEqual(["Mintral", "transportista"]);
    expect(saved(onSave).badgeIds).toEqual([badges[1].id, "b1"]);
  });

  it("shows matches only while typing and offers to create a new one", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(BADGES_KEY, JSON.stringify([{ id: "b1", name: "santiago" }]));
    renderForm();
    expect(screen.queryByText("Todas las etiquetas")).toBeNull();
    expect(screen.queryByRole("button", { name: "santiago" })).toBeNull();

    const input = screen.getByPlaceholderText(/Busca o crea una etiqueta/);
    await user.type(input, "sant");
    expect(await screen.findByRole("button", { name: "santiago" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'Crear "sant"' })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "Santiago");
    expect(screen.queryByRole("button", { name: /Crear/ })).toBeNull();
  });

  it("adds an existing badge from the matches", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(BADGES_KEY, JSON.stringify([{ id: "b1", name: "santiago" }]));
    const onSave = renderForm();
    await pickAna(user);
    await user.type(screen.getByPlaceholderText(/Busca o crea una etiqueta/), "sant");
    await user.click(await screen.findByRole("button", { name: "santiago", pressed: false }));
    expect(screen.getByRole("button", { name: "Quitar santiago" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(saved(onSave).badgeIds).toEqual(["b1"]);
  });

  it("creates a badge from the Crear option", async () => {
    const user = userEvent.setup();
    const onSave = renderForm();
    await pickAna(user);
    await user.type(screen.getByPlaceholderText(/Busca o crea una etiqueta/), "transportista");
    await user.click(screen.getByRole("button", { name: 'Crear "transportista"' }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const badges = JSON.parse(window.localStorage.getItem(BADGES_KEY) ?? "[]");
    expect(badges.map((b: { name: string }) => b.name)).toEqual(["transportista"]);
    expect(saved(onSave).badgeIds).toEqual([badges[0].id]);
  });

  it("renames and deletes badges from the matches", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      BADGES_KEY,
      JSON.stringify([
        { id: "b1", name: "santiago" },
        { id: "b2", name: "valpo" },
      ])
    );
    renderForm();
    const input = screen.getByPlaceholderText(/Busca o crea una etiqueta/);
    await user.type(input, "santiago");
    await user.click(await screen.findByRole("button", { name: "Renombrar santiago" }));
    const editor = screen.getByLabelText("Renombrar");
    await user.clear(editor);
    await user.type(editor, "Santiago Centro{Enter}");

    await user.clear(input);
    await user.type(input, "valpo");
    await user.click(screen.getByRole("button", { name: "Eliminar valpo" }));
    expect(JSON.parse(window.localStorage.getItem(BADGES_KEY) ?? "[]")).toEqual([
      { id: "b1", name: "Santiago Centro" },
    ]);
  });
});

describe("ContactFormModal — contact channels", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows a channel as activated only once it has a valid address", async () => {
    const user = userEvent.setup();
    const onSave = renderForm();
    await user.click(screen.getByRole("button", { name: /Ana Soto/ }));
    expect(screen.getAllByText("Sin configurar")).toHaveLength(4);

    await user.type(screen.getByLabelText("Llamada por Google Meet"), "ana");
    expect(screen.getAllByText("Sin configurar")).toHaveLength(4);
    expect(screen.queryByText("Incompleto")).toBeNull();

    await user.type(screen.getByLabelText("Llamada por Google Meet"), "@gmail.com");
    expect(screen.getByText("Activado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(saved(onSave)).toMatchObject({ methods: ["meet"], channels: { meet: "ana@gmail.com" } });
  });

  it("saves without a channel that isn't valid", async () => {
    const user = userEvent.setup();
    const onSave = renderForm();
    await user.click(screen.getByRole("button", { name: /Ana Soto/ }));
    await user.type(screen.getByLabelText("Llamada por Microsoft Teams"), "ana");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(saved(onSave)).toMatchObject({ methods: [], channels: {} });
  });

  it("fills WhatsApp from the phone until it's given its own number", async () => {
    const user = userEvent.setup();
    renderForm();
    const phone = screen.getByLabelText("Llamada telefónica");
    const whatsapp = screen.getByLabelText("Llamada por WhatsApp");
    await user.type(phone, "912345678");
    expect(digitsOf(whatsapp)).toBe("56912345678");

    await user.clear(whatsapp);
    await user.type(whatsapp, "+56987654321");
    await user.type(phone, "9");
    expect(digitsOf(whatsapp)).toBe("56987654321");
    expect(screen.queryByRole("button", { name: /Usar el número/ })).toBeNull();
  });

  it("keeps stored data it doesn't edit when editing", async () => {
    const user = userEvent.setup();
    const imported: BookContact = {
      id: "i",
      name: "Importado",
      phone: "+56912345678",
      role: "Supervisor",
      methods: ["phone"],
      channels: { phone: "+56912345678" },
      rut: "12.345.678-5",
      company: "Mintral",
      position: "Supervisor",
      description: "Del CSV",
    };
    const onSave = renderForm(imported);
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Importado");
    expect(digitsOf(screen.getByLabelText("Llamada telefónica"))).toBe("56912345678");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(saved(onSave)).toMatchObject({
      id: "i",
      company: "Mintral",
      position: "Supervisor",
      description: "Del CSV",
      role: "Supervisor",
      methods: ["phone"],
    });
  });
});
