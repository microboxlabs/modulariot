import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContactTable, {
  ContactCard,
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
    role: "Rol",
    company: "Empresa",
    badges: "Etiquetas",
    methods: "Métodos de contacto",
    actions: "Acciones",
  },
  methodLabels: {
    phone: "Llamada telefónica",
    whatsapp: "Llamada por WhatsApp",
    meet: "Llamada por Google Meet",
    teams: "Llamada por Microsoft Teams",
    email: "Correo",
  },
  copied: "Copiado",
  notConnected: "No conectado",
  clickToCopy: "Clic para copiar",
  edit: "Editar",
  remove: "Eliminar contacto",
  card: {
    member: "Miembro",
    external: "Externo",
    provisional: "Por completar",
    unreachable: "Sin correo ni WhatsApp",
    rut: "RUT",
    reaches: "Recibe",
    reachesNone: "Ninguna regla en uso le escribe",
    dependsOnEvent: "según el evento",
  },
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
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const row = screen.getByText("Persona Ejemplo").closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText("P")).toBeInTheDocument();
    expect(cells.getByText("Jefe de turno")).toBeInTheDocument();
    expect(cells.getByText("desarrollo")).toBeInTheDocument();
    expect(cells.getByText("norte")).toBeInTheDocument();
    expect(
      cells.getByRole("button", {
        name: "Llamada por WhatsApp: +56 9 1234 5678",
      })
    ).toBeInTheDocument();
    expect(
      cells.getByRole("button", {
        name: "Llamada por Google Meet: persona@example.com",
      })
    ).toBeInTheDocument();
    expect(
      cells.queryByRole("button", { name: /Llamada telefónica/ })
    ).toBeNull();
    expect(
      cells.getByRole("img", { name: "Llamada telefónica: No conectado" })
    ).toBeInTheDocument();
    expect(
      cells.getByRole("img", {
        name: "Llamada por Microsoft Teams: No conectado",
      })
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
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    await user.click(
      screen.getByRole("button", {
        name: "Llamada por Google Meet: persona@example.com",
      })
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

  it("opens the contact from its row, but not when copying an address", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={onEdit}
        onRemove={vi.fn()}
      />
    );
    await user.click(
      screen.getByRole("button", { name: /Llamada por WhatsApp/ })
    );
    expect(onEdit).not.toHaveBeenCalled();
    await user.click(screen.getByText("Externo"));
    expect(onEdit).toHaveBeenCalledWith(person);
  });

  it("calls onEdit and onRemove from the row menu", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={onEdit}
        onRemove={onRemove}
      />
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
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const meet = screen.getByRole("button", {
      name: "Llamada por Google Meet: persona@example.com",
    });
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.hover(meet);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "persona@example.com"
    );

    await user.unhover(meet);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("switches straight from one circle's tooltip to the next", async () => {
    const user = userEvent.setup();
    render(
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    await user.hover(
      screen.getByRole("button", {
        name: "Llamada por Google Meet: persona@example.com",
      })
    );
    await user.hover(
      screen.getByRole("img", {
        name: "Llamada por Microsoft Teams: No conectado",
      })
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
      <ContactTable
        contacts={[person]}
        badges={badges}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
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

describe("ContactCard", () => {
  const renderCard = (contact: BookContact) =>
    render(
      <ContactCard
        contact={contact}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        badgesById={new Map(badges.map((b) => [b.id, b]))}
      />
    );

  it("shows the company with its RUT, the email, the phone and the notes", () => {
    renderCard({
      ...person,
      role: "Supervisor",
      company: "Empresa Ejemplo",
      companyRut: "76.111.222-8",
      email: "persona@example.com",
      orgMemberId: "member_1",
    });
    expect(screen.getByText("Miembro")).toBeInTheDocument();
    expect(screen.getByText("Empresa Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("76.111.222-8")).toBeInTheDocument();
    expect(screen.getByText("persona@example.com")).toBeInTheDocument();
    expect(screen.getByText("Jefe de turno")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sin correo ni WhatsApp")).toBeNull();
  });

  it("lists the rules that write to the contact, dashed when it depends on the event", () => {
    render(
      <ContactCard
        contact={person}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        badgesById={new Map()}
        reach={[
          { ruleId: "r1", name: "Alertas", state: "ACTIVE", always: true },
          { ruleId: "r2", name: "Hitos", state: "ACTIVE", always: false },
        ]}
        ruleHref={(id) => `/rules/${id}`}
      />
    );
    expect(screen.getByRole("link", { name: "Alertas" })).toHaveAttribute(
      "href",
      "/rules/r1"
    );
    expect(screen.getByRole("link", { name: "Hitos" })).toHaveAttribute(
      "title",
      "Hitos · según el evento"
    );
  });

  it("says when no rule writes to the contact", () => {
    render(
      <ContactCard
        contact={person}
        labels={labels}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        badgesById={new Map()}
        reach={[]}
        ruleHref={(id) => id}
      />
    );
    expect(
      screen.getByText("Ninguna regla en uso le escribe")
    ).toBeInTheDocument();
  });

  it("warns when rules can't reach the contact and marks it external", () => {
    renderCard({
      ...person,
      phone: "",
      methods: ["meet"],
      channels: { meet: "persona@example.com" },
      provisional: true,
    });
    expect(screen.getByText("Externo")).toBeInTheDocument();
    expect(screen.getByText("Por completar")).toBeInTheDocument();
    expect(screen.getByLabelText("Sin correo ni WhatsApp")).toBeInTheDocument();
  });

  it("treats a phone number as a WhatsApp fallback for rules", () => {
    renderCard({ ...person, methods: ["meet"], channels: {} });
    expect(screen.queryByLabelText("Sin correo ni WhatsApp")).toBeNull();
  });
});
