import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ShowNotification } from "@/features/notifications/notification";
import ImportContactsModal from "./import-contacts-modal";
import type { BookContact } from "./store";

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const dict = es.pages.userSettings as unknown as I18nRecord;
const existing: BookContact[] = [
  {
    id: "a",
    name: "Existente",
    phone: "",
    role: "",
    methods: [],
    rut: "11.111.111-1",
  },
];

describe("ImportContactsModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the example layout until a file is loaded", () => {
    render(
      <ImportContactsModal
        show
        onClose={vi.fn()}
        contacts={existing}
        onImport={vi.fn()}
        dict={dict}
      />
    );
    expect(screen.getByText("Formato esperado (ejemplo)")).toBeInTheDocument();
    expect(screen.getByText("Persona Ejemplo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("previews the file and imports only the valid rows", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(
      <ImportContactsModal
        show
        onClose={onClose}
        contacts={existing}
        onImport={onImport}
        dict={dict}
      />
    );
    const csv = [
      "nombre;rut;etiquetas;whatsapp",
      "Persona Nueva;22.222.222-2;transportista|turno noche;+56900000001",
      "Duplicado;11.111.111-1;;",
    ].join("\n");
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File([csv], "contactos.csv", { type: "text/csv" });
    // jsdom's File has no Blob#text().
    Object.assign(file, { text: () => Promise.resolve(csv) });
    await user.upload(input as HTMLInputElement, file);

    expect(
      await screen.findByText("Vista previa: 1 de 2 filas se importarán")
    ).toBeInTheDocument();
    expect(screen.getByText("RUT ya registrado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Importar" }));
    const added = onImport.mock.calls[0]?.[0] as BookContact[];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      name: "Persona Nueva",
      methods: ["whatsapp"],
    });
    const stored = JSON.parse(
      window.localStorage.getItem("miot.prototype.contact-badges.v1") ?? "[]"
    );
    expect(stored.map((b: { name: string }) => b.name)).toEqual([
      "transportista",
      "turno noche",
    ]);
    expect(added[0]?.badgeIds).toEqual(stored.map((b: { id: string }) => b.id));
    expect(onClose).toHaveBeenCalled();
  });
  it("reports what the API did not create and stays open when the import fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onImport = vi
      .fn()
      .mockResolvedValueOnce({ created: 1, skipped: 1, errors: 0, rows: [] })
      .mockRejectedValueOnce(new Error("HTTP 500"));
    render(
      <ImportContactsModal
        show
        onClose={onClose}
        contacts={[]}
        onImport={onImport}
        dict={dict}
      />
    );
    const csv = ["nombre;rut", "Uno;22.222.222-2", "Dos;33.333.333-3"].join(
      "\n"
    );
    const file = new File([csv], "contactos.csv", { type: "text/csv" });
    Object.assign(file, { text: () => Promise.resolve(csv) });
    await user.upload(
      document.querySelector<HTMLInputElement>(
        'input[type="file"]'
      ) as HTMLInputElement,
      file
    );
    await screen.findByText("Vista previa: 2 de 2 filas se importarán");

    await user.click(screen.getByRole("button", { name: "Importar" }));
    expect(ShowNotification).toHaveBeenCalledWith({
      type: "success",
      message: "1 contactos importados",
    });
    expect(ShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" })
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Importar" }));
    expect(ShowNotification).toHaveBeenCalledWith({
      type: "error",
      message: "No se pudieron importar los contactos.",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
