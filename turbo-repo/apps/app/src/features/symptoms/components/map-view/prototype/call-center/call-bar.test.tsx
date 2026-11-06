import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallBar from "./call-bar";
import {
  CallSessionProvider,
  useCallSession,
  type CallSession,
} from "./call-session";
import type { StartCallOptions } from "./telnyx-call";
import { useUnsavedNavigation } from "@/features/common/hooks/use-unsaved-navigation";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/es/home" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

const dict = es as unknown as I18nRecord;
const CASE_HREF = "/es/symptoms/map-view/case-1?open=1&menu=call_driver";

let session: CallSession | null = null;
function Probe() {
  session = useCallSession();
  return null;
}
const s = () => {
  if (!session) throw new Error("no session");
  return session;
};

const call = {
  key: "case-1:contact-1",
  context: { caseId: "case-1", caseHref: CASE_HREF, caseLabel: "TEST-01" },
  contactName: "Synthetic contact",
  contactRole: "Dispatcher",
  method: "phone" as const,
  calleeNumber: "+12025550101",
};

function mount() {
  return render(
    <CallSessionProvider>
      <Probe />
      <CallBar dict={dict} />
    </CallSessionProvider>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  session = null;
  nav.push.mockClear();
  nav.pathname = "/es/home";
});

describe("CallBar", () => {
  it("is hidden without a call", () => {
    mount();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows the contact, case and timer of the open call", () => {
    mount();
    act(() => {
      s().startManual(call);
    });
    const bar = screen.getByRole("region", {
      name: es.symptoms.call_bar_label,
    });
    expect(bar).toHaveTextContent("Synthetic contact");
    expect(bar).toHaveTextContent("Dispatcher");
    expect(bar).toHaveTextContent("TEST-01");
    expect(bar).toHaveTextContent("00:00");
    // Timed calls have no mute: the call is outside the browser.
    expect(
      screen.queryByRole("button", { name: es.symptoms.call_mute })
    ).toBeNull();
  });

  it("goes back to the case with the call open", () => {
    mount();
    act(() => {
      s().startManual(call);
    });
    const tick = s().focusTick;
    fireEvent.click(screen.getByTitle(es.symptoms.call_bar_back));
    expect(nav.push).toHaveBeenCalledWith(CASE_HREF);
    expect(s().focusTick).toBe(tick + 1);
  });

  it("only asks for focus when already on the case page", () => {
    nav.pathname = "/es/symptoms/map-view/case-1";
    mount();
    act(() => {
      s().startManual(call);
    });
    fireEvent.click(screen.getByTitle(es.symptoms.call_bar_back));
    expect(nav.push).not.toHaveBeenCalled();
    expect(s().focusTick).toBe(1);
  });

  it("keeps the current draft and focus when navigation is declined", () => {
    function Draft() {
      useUnsavedNavigation(true, "Unsaved draft");
      return null;
    }
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    render(
      <CallSessionProvider>
        <Probe />
        <Draft />
        <CallBar dict={dict} />
      </CallSessionProvider>
    );
    act(() => {
      s().startManual(call);
    });
    fireEvent.click(screen.getByTitle(es.symptoms.call_bar_back));
    expect(confirm).toHaveBeenCalledWith("Unsaved draft");
    expect(nav.push).not.toHaveBeenCalled();
    expect(s().focusTick).toBe(0);
    confirm.mockRestore();
  });

  it("marks the call as done from any page and asks to record it", () => {
    mount();
    act(() => {
      s().startManual(call);
    });
    fireEvent.click(
      screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
    );
    expect(s().call?.status).toBe("ended");
    expect(screen.getByRole("region")).toHaveTextContent(
      es.symptoms.call_ended_pending
    );
    fireEvent.click(
      screen.getByRole("button", { name: es.symptoms.call_record_result })
    );
    expect(nav.push).toHaveBeenCalledWith(CASE_HREF);
  });

  it("cancels the call", () => {
    mount();
    act(() => {
      s().startManual(call);
    });
    fireEvent.click(
      screen.getByRole("button", { name: es.symptoms.call_modal_cancel })
    );
    expect(s().call).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("mutes a browser call", async () => {
    mount();
    let options: StartCallOptions | null = null;
    const live = { hangup: vi.fn(), setMuted: vi.fn() };
    act(() => {
      s().startTelnyx({
        ...call,
        destination: "+12025550101",
        token: vi.fn().mockResolvedValue({
          token: "jwt",
          callerNumber: "+12025550100",
          expiresAt: "2026-11-05T10:00:00Z",
          callRef: "ref-1",
        }),
        dial: vi.fn(async (o: StartCallOptions) => {
          options = o;
          return live;
        }),
        endCall: vi.fn().mockResolvedValue(undefined),
      });
    });
    const mute = await screen.findByRole("button", {
      name: es.symptoms.call_mute,
    });
    await waitFor(() => expect(options).not.toBeNull());
    expect(mute).toBeDisabled();
    fireEvent.click(mute);
    expect(live.setMuted).not.toHaveBeenCalled();
    expect(s().call?.muted).toBe(false);
    act(() => {
      options?.onPhase("ringing", null);
    });
    await waitFor(() => expect(mute).toBeEnabled());
    fireEvent.click(mute);
    expect(live.setMuted).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole("button", { name: es.symptoms.call_unmute })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("says a browser call was cut by a reload", () => {
    sessionStorage.setItem(
      "miot.call-session.v1",
      JSON.stringify({
        id: "a",
        key: call.key,
        context: {
          ...call.context,
          target: null,
          script: null,
          defaultMessage: "",
          message: "",
        },
        contactName: call.contactName,
        contactRole: call.contactRole,
        method: "phone",
        kind: "telnyx",
        status: "live",
        startedAt: Date.now() - 60_000,
        phase: "active",
        answeredAt: Date.now() - 45_000,
        dialReady: true,
        callRef: null,
        providerCallId: null,
        calleeNumber: "+12025550101",
        teamsConnectionId: null,
        notice: null,
        error: null,
        result: null,
        muted: false,
        leftAt: Date.now() - 5_000,
      })
    );
    mount();
    const bar = screen.getByRole("region");
    expect(bar).toHaveTextContent(es.symptoms.call_dropped_on_reload);
    expect(bar).toHaveTextContent("00:40");
    expect(
      screen.getByRole("button", { name: es.symptoms.call_record_result })
    ).toBeTruthy();
  });
});
