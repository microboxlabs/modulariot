import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContactTable, {
  contactMethodValue,
  type ContactTableLabels,
} from "./contact-table";
import type { BookContact } from "./store";
import type { ContactBadge } from "./taxonomy-store";

const badges: ContactBadge[] = [
  { id: "b1", name: "desarrollo" },
  { id: "b2", name: "norte" },
];

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const labels: ContactTableLabels = {
  columns: {
    name: "Nombre",
    badges: "Etiquetas",
    methods: "Métodos de contacto",
    actions: "Acciones",
  },
  methodLabels: {
    phone: "Llamada telefónica",
    whatsapp: "Llamada por WhatsApp",
    meet: "Llamada por Google Meet",
    teams: "Llamada por Microsoft Teams",
  },
  copied: "Copiado",
  notConnected: "No conectado",
  clickToCopy: "Clic para copiar",
  edit: "Editar",
  remove: "Eliminar contacto",
};

const person: BookContact = {
  id: "contact_1",
  name: "Persona Ejemplo",
  phone: "+56912345678",
  role: "",
  description: "Jefe de turno",
  badgeIds: ["b1", "b2", "deleted"],
  methods: ["whatsapp", "meet"],
  channels: { whatsapp: "+56912345678", meet: "persona@example.com" },
};

describe("ContactTable", () => {
  it("shows name, description, badges and methods for a contact (skipping deleted badges)", () => {
    render(
      <ContactTable contacts={[person]} badges={badges}
        labels={labels} onEdit={vi.fn()} onRemove={vi.fn()} />
    );
    const row = screen.getByText("Persona Ejemplo").closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText("P")).toBeInTheDocument();
    expect(cells.getByText("Jefe de turno")).toBeInTheDocument();
    expect(cells.getByText("desarrollo")).toBeInTheDocument();
    expect(cells.getByText("norte")).toBeInTheDocument();
    expect(
      cells.getByRole("button", { name: "Llamada por WhatsApp: +56 9 1234 5678" })
    ).toBeInTheDocument();
    expect(
      cells.getByRole("button", { name: "Llamada por Google Meet: persona@example.com" })
    ).toBeInTheDocument();
    expect(cells.queryByRole("button", { name: /Llamada telefónica/ })).toBeNull();
    expect(
      cells.getByRole("img", { name: "Llamada telefónica: No conectado" })
    ).toBeInTheDocument();
    expect(
      cells.getByRole("img", { name: "Llamada por Microsoft Teams: No conectado" })
    ).toBeInTheDocument();
  });

  it("copies a method's address on click", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <ContactTable contacts={[person]} badges={badges}
        labels={labels} onEdit={vi.fn()} onRemove={vi.fn()} />
    );
    await user.click(
      screen.getByRole("button", { name: "Llamada por Google Meet: persona@example.com" })
    );
    expect(writeText).toHaveBeenCalledWith("persona@example.com");
  });

  it("falls back to the role when there is no description", () => {
    render(
      <ContactTable
        contacts={[{ ...person, description: undefined, role: "Supervisor" }]}
        badges={badges}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Supervisor")).toBeInTheDocument();
  });

  it("calls onEdit and onRemove from the row menu", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <ContactTable contacts={[person]} badges={badges}
        labels={labels} onEdit={onEdit} onRemove={onRemove} />
    );
    await user.click(screen.getByRole("button", { name: "Acciones" }));
    await user.click(screen.getByText("Editar"));
    expect(onEdit).toHaveBeenCalledWith(person);

    await user.click(screen.getByRole("button", { name: "Acciones" }));
    await user.click(screen.getByText("Eliminar contacto"));
    expect(onRemove).toHaveBeenCalledWith("contact_1");
  });
});

describe("contact method tooltip", () => {
  it("shows only while the circle is hovered", async () => {
    const user = userEvent.setup();
    render(
      <ContactTable contacts={[person]} badges={badges}
        labels={labels} onEdit={vi.fn()} onRemove={vi.fn()} />
    );
    const meet = screen.getByRole("button", {
      name: "Llamada por Google Meet: persona@example.com",
    });
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.hover(meet);
    expect(screen.getByRole("tooltip")).toHaveTextContent("persona@example.com");

    await user.unhover(meet);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("switches straight from one circle's tooltip to the next", async () => {
    const user = userEvent.setup();
    render(
      <ContactTable contacts={[person]} badges={badges}
        labels={labels} onEdit={vi.fn()} onRemove={vi.fn()} />
    );
    await user.hover(
      screen.getByRole("button", { name: "Llamada por Google Meet: persona@example.com" })
    );
    await user.hover(
      screen.getByRole("img", { name: "Llamada por Microsoft Teams: No conectado" })
    );
    const tooltips = screen.getAllByRole("tooltip");
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0]).toHaveTextContent("No conectado");
  });

  it("closes after clicking to copy once the pointer leaves", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    render(
      <ContactTable contacts={[person]} badges={badges}
        labels={labels} onEdit={vi.fn()} onRemove={vi.fn()} />
    );
    const meet = screen.getByRole("button", {
      name: "Llamada por Google Meet: persona@example.com",
    });
    await user.click(meet);
    await user.unhover(meet);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("contactMethodValue", () => {
  it("falls back to the legacy phone for phone/WhatsApp", () => {
    const legacy: BookContact = {
      id: "c",
      name: "Legacy",
      phone: "+56987654321",
      role: "",
      methods: ["phone", "teams"],
    };
    expect(contactMethodValue(legacy, "phone")).toBe("+56987654321");
    expect(contactMethodValue(legacy, "teams")).toBe("");
    expect(contactMethodValue(legacy, "whatsapp")).toBe("");
  });
});
