import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallCenterMenu from "./call-center-menu";

const data = vi.hoisted(() => ({
  contacts: [] as unknown[],
  treatments: undefined as unknown,
  level: undefined as unknown,
  treatmentsId: undefined as unknown,
  createContact: vi.fn(),
}));

vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  createContact: data.createContact,
  contactsKey: "contacts",
  useContacts: () => ({ data: data.contacts, isLoading: false }),
  useSymptomTreatments: (id: unknown) => {
    data.treatmentsId = id;
    return { data: data.treatments };
  },
}));

vi.mock("@/features/symptoms/maintainer/maintainer-api", () => ({
  useLevelResponse: () => ({ data: data.level }),
}));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
}));

const dict = es as unknown as I18nRecord;

const contact = (id: string, name: string, role: string, active = true) => ({
  id,
  name,
  role,
  phone: "+12025550101",
  methods: ["PHONE"],
  active,
  lastCalledAt: null,
  answered: 2,
  missed: 1,
});

const treatment = {
  symptom_info: { id: -7, name: "Exceso de velocidad", icu_code: 3 },
  trip_info: { driver: "Ana Pérez", driver_contact: "+12025550102" },
} as unknown as TreatmentsGeneralResponseItem;

const levelWith = (steps: unknown[]) => ({
  version: 4,
  level: {
    response: { operator: true, slaMinutes: 10, steps },
  },
});

function renderMenu() {
  const onCall = vi.fn();
  render(
    <CallCenterMenu
      dict={dict}
      treatmentData={treatment}
      startedAt={Date.now()}
      skippedTo={null}
      onSkip={vi.fn()}
      onCall={onCall}
    />
  );
  return onCall;
}

beforeEach(() => {
  data.contacts = [
    contact("c1", "Luis Soto", "Transportista"),
    contact("c2", "Marta Díaz", "Jefe de turno"),
    contact("c3", "Inactivo", "Transportista", false),
  ];
  data.treatments = undefined;
  data.level = undefined;
});

describe("CallCenterMenu", () => {
  it("keeps a newer call selection when an earlier contact save finishes", async () => {
    let finishSave = () => {};
    data.createContact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve(contact("new-contact", "Saved contact", ""));
        })
    );
    const user = userEvent.setup();
    const onCall = renderMenu();
    await user.click(screen.getByRole("button", { name: "Nuevo número" }));
    await user.click(screen.getByLabelText("Número de teléfono"));
    await user.paste("+12025550103");
    await user.type(screen.getByLabelText("Nombre"), "Saved contact");
    await user.click(
      screen.getByRole("button", { name: "Llamar y guardar en la libreta" })
    );
    await user.click(screen.getByRole("button", { name: /Luis Soto/ }));
    await act(async () => finishSave());
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "c1" })
    );
  });

  it("lists the level's steps with the contacts of each role", async () => {
    data.level = levelWith([
      {
        role: "Conductor",
        channel: "call",
        budgetMinutes: 2,
        script: "Hola {{conductor}}",
      },
      {
        role: "Transportista",
        channel: "whatsapp",
        budgetMinutes: 3,
        script: null,
      },
      { role: "Supervisor", channel: "call", budgetMinutes: 3, script: null },
    ]);
    const user = userEvent.setup();
    const onCall = renderMenu();

    const due = document.querySelector('[aria-current="step"]') as HTMLElement;
    expect(within(due).getByText("Conductor del viaje")).toBeTruthy();
    expect(within(due).getByText("Ana Pérez")).toBeTruthy();
    expect(within(due).getByText("Hola Ana Pérez")).toBeTruthy();

    expect(screen.getByText("Luis Soto")).toBeTruthy();
    expect(screen.queryByText("Inactivo")).toBeNull();
    // The driver has a number: phone and WhatsApp.
    expect(within(due).getByLabelText("Llamada por WhatsApp")).toBeTruthy();
    // Luis has only a phone, and step 2 asks for WhatsApp.
    const luis = screen.getByRole("button", { name: /Luis Soto/ });
    expect(within(luis).getByLabelText("Llamada telefónica")).toBeTruthy();
    expect(within(luis).queryByLabelText("Llamada por WhatsApp")).toBeNull();
    expect(within(luis).getByText("No disponible por WhatsApp")).toBeTruthy();
    expect(
      screen.getByText("Nadie en la libreta tiene este rol.")
    ).toBeTruthy();
    expect(screen.getByText(/SLA \d+:\d\d/)).toBeTruthy();

    // The rest of the book is collapsed.
    expect(screen.queryByText("Marta Díaz")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Otros contactos (1)" })
    );
    expect(screen.getByText("Marta Díaz")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Luis Soto/ }));
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "c1",
        role: "Transportista",
        phone: "+12025550101",
        methods: ["phone"],
        stats: expect.objectContaining({ accepted: 2, denied: 1 }),
      })
    );
  });

  it("marks who was already called in this case from its CALL actions", () => {
    data.level = levelWith([
      {
        role: "Transportista",
        channel: "call",
        budgetMinutes: 2,
        script: null,
      },
    ]);
    data.treatments = [
      {
        actions: [
          {
            kind: "CALL",
            contactId: "c1",
            contactRole: "Transportista",
            performedAt: new Date().toISOString(),
          },
        ],
      },
    ];
    renderMenu();
    expect(data.treatmentsId).toBe(-7);
    expect(screen.getByText(es.symptoms.call_center_just_called)).toBeTruthy();
  });

  it("shows the driver and the whole book when the level has no steps", () => {
    renderMenu();
    expect(
      screen.queryByRole("button", { name: /Otros contactos/ })
    ).toBeNull();
    expect(screen.getByRole("button", { name: /Ana Pérez/ })).toBeTruthy();
    expect(screen.getByText("Luis Soto")).toBeTruthy();
    expect(screen.getByText("Marta Díaz")).toBeTruthy();
  });
});
