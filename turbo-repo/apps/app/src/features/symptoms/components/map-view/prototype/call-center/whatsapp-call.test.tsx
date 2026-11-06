import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallDialingStep from "./call-dialing-step";
import IncomingWhatsAppCalls from "./incoming-whatsapp-calls";
import { CallSessionProvider } from "./call-session";
import type { StartCallOptions, TelephonyCallResult } from "./telnyx-call";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ lang: "es" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/es/symptoms",
}));
vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    controlTowerRequest: request,
  })
);

const dict = es as unknown as I18nRecord;
const t = es.symptoms;

function permission(state: "CAN_CALL" | "NO_PERMISSION", enabled = true) {
  return {
    callingEnabled: enabled,
    state,
    permission: state === "CAN_CALL" ? "PERMANENT" : "NONE",
    canRequest: state !== "CAN_CALL",
    expiresAt: null,
    lastRequestAt: null,
    refusal: state === "CAN_CALL" ? "ALREADY_GRANTED" : null,
    nextRequestAt: null,
  };
}

const Wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <CallSessionProvider>{children}</CallSessionProvider>
  </SWRConfig>
);
const renderInSession = (ui: ReactElement) => render(ui, { wrapper: Wrapper });

const line = {
  connectionId: "p1",
  provider: "TELNYX" as const,
  name: "Plataforma",
  callerNumber: "+56900000000",
  ready: true,
  managed: true,
};

const result = (answered: boolean): TelephonyCallResult => ({
  provider: "TELNYX",
  answered,
  durationSeconds: answered ? 30 : 0,
  hangupCause: answered ? "normal_clearing" : "call_rejected",
  sipCode: null,
  callId: "sdk-1",
  calleeNumber: "+56911111111",
  startedAt: "2026-11-04T10:00:00.000Z",
});

function renderStep(whatsAppCalling: boolean) {
  let options: StartCallOptions | null = null;
  const dial = vi.fn(async (o: StartCallOptions) => {
    options = o;
    return { hangup: vi.fn() };
  });
  const token = vi.fn().mockResolvedValue({
    token: "jwt",
    callerNumber: "+56900000000",
    expiresAt: "2026-11-05T10:00:00Z",
    callRef: "ref-1",
  });
  const callOutcome = vi.fn().mockResolvedValue({ failure: null });
  const onConfirm = vi.fn();
  renderInSession(
    <CallDialingStep
      dict={dict}
      contactName="Juan"
      contactRole="Conductor"
      contactPhone="+56 9 1111 1111"
      channels={{ whatsapp: "+56911111111" }}
      allowedMethods={["phone", "whatsapp"]}
      reason="Hola"
      line={line}
      whatsAppCalling={whatsAppCalling}
      caseRef="77"
      dial={dial}
      token={token}
      callOutcome={callOutcome}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />
  );
  return { dial, token, callOutcome, onConfirm, opts: () => options };
}

beforeEach(() => {
  sessionStorage.clear();
  request.mockReset();
});

describe("WhatsApp button", () => {
  it("starts the in-app call when WhatsApp calling is on", async () => {
    request.mockResolvedValue(permission("CAN_CALL"));
    const { dial, token, onConfirm, opts } = renderStep(true);
    const button = await screen.findByRole("button", { name: t.call_wa_call });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(dial).toHaveBeenCalled());
    expect(token).toHaveBeenCalledWith({
      calleeNumber: "+56911111111",
      caseRef: "77",
      channel: "WHATSAPP",
    });
    expect(opts()?.destination).toBe("+56911111111");
    expect(opts()?.clientState).toBe(btoa("ref-1"));
    act(() => opts()?.onEnd(result(true)));
    expect(onConfirm).toHaveBeenCalledWith(30, "whatsapp", result(true));
  });

  it("keeps the wa.me chat as a secondary action while calling is on", async () => {
    request.mockResolvedValue(permission("CAN_CALL"));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { token } = renderStep(true);
    fireEvent.click(screen.getByRole("button", { name: t.call_wa_open_chat }));
    expect(open).toHaveBeenCalledWith(
      "https://wa.me/56911111111?text=Hola",
      "_blank",
      "noopener,noreferrer"
    );
    expect(token).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("falls back to the chat when WhatsApp calling is off", () => {
    request.mockResolvedValue(permission("NO_PERMISSION", false));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { token } = renderStep(false);
    expect(
      screen.queryByRole("button", { name: t.call_wa_call })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: t.call_center_method_whatsapp })
    );
    expect(open).toHaveBeenCalledWith(
      "https://wa.me/56911111111?text=Hola",
      "_blank",
      "noopener,noreferrer"
    );
    expect(token).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("says the driver has not allowed calls and offers the request", async () => {
    request.mockResolvedValue(permission("NO_PERMISSION"));
    const { token } = renderStep(true);
    const button = await screen.findByRole("button", {
      name: t.call_wa_no_permission,
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByRole("button", { name: t.wa_call_request })
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(token).not.toHaveBeenCalled();
  });

  it("shows Meta's refusal (SIP 403) after the call ends", async () => {
    request.mockResolvedValue(permission("CAN_CALL"));
    const { dial, callOutcome, onConfirm, opts } = renderStep(true);
    callOutcome.mockResolvedValue({ failure: "whatsapp_no_permission" });
    const button = await screen.findByRole("button", { name: t.call_wa_call });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(dial).toHaveBeenCalled());
    act(() => opts()?.onEnd(result(false)));
    expect(await screen.findByText(t.call_wa_not_accepted)).toBeInTheDocument();
    expect(callOutcome).toHaveBeenCalledWith("ref-1");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("IncomingWhatsAppCalls", () => {
  it("offers a ringing call and takes it with the operator's login", async () => {
    request.mockImplementation(async (url: string) => {
      if (url.endsWith("/telephony"))
        return {
          preferred: null,
          active: line,
          lines: [line],
          whatsAppCalling: true,
        };
      if (url.endsWith("/telephony/whatsapp-calls"))
        return [
          {
            id: "in-1",
            callerNumber: "+56911111111",
            callerName: "Juan Pérez",
            caseRef: "4711",
            since: "2026-11-04T10:00:00Z",
          },
        ];
      throw new Error(`unexpected ${url}`);
    });
    const answer = vi.fn().mockReturnValue(new Promise(() => undefined));
    renderInSession(<IncomingWhatsAppCalls dict={dict} answer={answer} />);
    expect(await screen.findByText(/Juan Pérez/)).toBeInTheDocument();
    expect(screen.getByText("Caso 4711")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.wa_incoming_answer }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith("in-1"));
  });

  it("shows nothing while WhatsApp calling is off", async () => {
    request.mockResolvedValue({ preferred: null, active: line, lines: [line] });
    renderInSession(<IncomingWhatsAppCalls dict={dict} />);
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(request).not.toHaveBeenCalledWith(
      expect.stringContaining("whatsapp-calls")
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
