import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallDialingStep from "./call-dialing-step";
import type { CallPermissionView } from "./whatsapp-call-permission";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    controlTowerRequest: request,
  })
);

const dict = es as unknown as I18nRecord;

const view = (patch: Partial<CallPermissionView>): CallPermissionView => ({
  callingEnabled: true,
  state: "NO_PERMISSION",
  permission: "NONE",
  expiresAt: null,
  lastRequestAt: null,
  canRequest: true,
  refusal: null,
  nextRequestAt: null,
  ...patch,
});

function renderStep() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CallDialingStep
        dict={dict}
        contactName="Synthetic driver"
        contactRole="Conductor"
        contactPhone="+12025550101"
        channels={{ phone: "+12025550101", whatsapp: "+12025550102" }}
        allowedMethods={["phone", "whatsapp"]}
        reason="Step message"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    </SWRConfig>
  );
}

describe("WhatsApp call permission on the dialing step", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("shows nothing and keeps wa.me while calling is off", async () => {
    request.mockResolvedValue(view({ callingEnabled: false }));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderStep();
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(request.mock.calls[0][0]).toContain(
      "/whatsapp-call-permissions?phone=%2B12025550102"
    );
    expect(screen.queryByTestId("wa-call-permission")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Llamada por WhatsApp" })
    );
    expect(open).toHaveBeenCalledWith(
      "https://wa.me/12025550102?text=Step%20message",
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });

  it("shows when the contact can be called", async () => {
    request.mockResolvedValue(
      view({ state: "CAN_CALL", permission: "PERMANENT", canRequest: false })
    );
    renderStep();
    expect(await screen.findByText("WhatsApp: puede llamar")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Solicitar permiso" })
    ).toBeNull();
  });

  it("shows a pending request whose limit blocks another one", async () => {
    request.mockResolvedValue(
      view({
        state: "PENDING",
        canRequest: false,
        refusal: "DAILY_LIMIT",
        nextRequestAt: "2026-11-05T12:00:00Z",
      })
    );
    renderStep();
    expect(await screen.findByText("WhatsApp: permiso pendiente")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Solicitar permiso" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("title")).toContain(
      "Meta permite 1 solicitud por día"
    );
  });

  it("sends the request now and shows the new state", async () => {
    request.mockImplementation((url: string) =>
      url.endsWith("/requests")
        ? Promise.resolve({
            sent: true,
            refusal: null,
            detail: "wamid.1",
            nextRequestAt: null,
            view: view({
              state: "PENDING",
              canRequest: false,
              refusal: "DAILY_LIMIT",
            }),
          })
        : Promise.resolve(view({}))
    );
    renderStep();
    expect(
      await screen.findByText("WhatsApp: sin permiso de llamada")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar permiso" }));

    expect(await screen.findByText("Solicitud enviada")).toBeTruthy();
    expect(screen.getByText("WhatsApp: permiso pendiente")).toBeTruthy();
    const post = request.mock.calls.find(([url]) => url.endsWith("/requests"));
    expect(post?.[1]).toEqual({
      method: "POST",
      body: { phone: "+12025550102", name: "Synthetic driver" },
    });
  });

  it("explains a refused request", async () => {
    request.mockImplementation((url: string) =>
      url.endsWith("/requests")
        ? Promise.resolve({
            sent: false,
            refusal: "WEEKLY_LIMIT",
            detail: null,
            nextRequestAt: null,
            view: view({ canRequest: false, refusal: "WEEKLY_LIMIT" }),
          })
        : Promise.resolve(view({}))
    );
    renderStep();
    fireEvent.click(
      await screen.findByRole("button", { name: "Solicitar permiso" })
    );
    expect(
      await screen.findByText(
        "Meta permite 2 solicitudes por semana a cada contacto."
      )
    ).toBeTruthy();
  });
});
