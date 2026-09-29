import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import ImportContactsModal from "./import-contacts-modal";
import type { BookContact } from "./store";

vi.mock("@/features/notifications/notification", () => ({ ShowNotification: vi.fn() }));

const dict = es.pages.userSettings as unknown as I18nRecord;
const existing: BookContact[] = [
  { id: "a", name: "Existente", phone: "", role: "", methods: [], rut: "11.111.111-1" },
];

describe("ImportContactsModal", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the example layout until a file is loaded", () => {
    render(
      <ImportContactsModal show onClose={vi.fn()} contacts={existing} onImport={vi.fn()} dict={dict} />
    );
    expect(screen.getByText("Formato esperado (ejemplo)")).toBeInTheDocument();
    expect(screen.getByText("Rodrigo Seguel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("previews the file and imports only the valid rows", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(
      <ImportContactsModal show onClose={onClose} contacts={existing} onImport={onImport} dict={dict} />
    );
    const csv = [
      "nombre;rut;etiquetas;whatsapp",
      "Rodrigo Seguel;12.345.678-5;transportista|mintral;+56912345678",
      "Duplicado;11.111.111-1;;",
    ].join("\n");
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, new File([csv], "contactos.csv", { type: "text/csv" }));

    expect(await screen.findByText("Vista previa: 1 de 2 filas se importarán")).toBeInTheDocument();
    expect(screen.getByText("RUT ya registrado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Importar" }));
    const added = onImport.mock.calls[0]?.[0] as BookContact[];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      name: "Rodrigo Seguel",
      methods: ["whatsapp"],
    });
    const stored = JSON.parse(window.localStorage.getItem("miot.prototype.contact-badges.v1") ?? "[]");
    expect(stored.map((b: { name: string }) => b.name)).toEqual(["transportista", "mintral"]);
    expect(added[0]?.badgeIds).toEqual(stored.map((b: { id: string }) => b.id));
    expect(onClose).toHaveBeenCalled();
  });
});
