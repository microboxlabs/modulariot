import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CallSessionProvider,
  useCallSession,
  type CallSession,
} from "./call-session";
import { CALL_SESSION_STORAGE_KEY } from "./call-session-store";
import type { StartCallOptions } from "./telnyx-call";

let session: CallSession | null = null;
function Probe() {
  session = useCallSession();
  return null;
}
const s = () => {
  if (!session) throw new Error("no session");
  return session;
};

const context = {
  caseId: "case-1",
  caseHref: "/es/symptoms/map-view/case-1?open=1&menu=call_driver",
  caseLabel: "TEST-01",
  target: {
    id: "contact-1",
    personName: "Synthetic contact",
    role: "Dispatcher",
    phone: "+12025550101",
    methods: ["phone" as const],
    stats: {
      lastCallAt: new Date("2026-11-01T10:00:00Z"),
      accepted: 1,
      denied: 0,
    },
  },
  script: { message: "Step message", goal: "Step goal" },
  defaultMessage: "Default",
  message: "Step message",
};

const manual = {
  key: "case-1:contact-1",
  context,
  contactName: "Synthetic contact",
  contactRole: "Dispatcher",
  method: "phone" as const,
  calleeNumber: "+12025550101",
};

function mount(endCall = vi.fn().mockResolvedValue(undefined)) {
  const view = render(
    <CallSessionProvider endCall={endCall}>
      <Probe />
    </CallSessionProvider>
  );
  return { ...view, endCall };
}

function browserCall() {
  let options: StartCallOptions | null = null;
  const live = { hangup: vi.fn(), setMuted: vi.fn() };
  const dial = vi.fn(async (o: StartCallOptions) => {
    options = o;
    return live;
  });
  const token = vi.fn().mockResolvedValue({
    token: "secret-login-token",
    callerNumber: "+12025550100",
    expiresAt: "2026-11-05T10:00:00Z",
    callRef: "ref-1",
  });
  const endCall = vi.fn().mockResolvedValue(undefined);
  return { dial, token, endCall, live, opts: () => options };
}

beforeEach(() => {
  sessionStorage.clear();
  session = null;
});

describe("CallSessionProvider", () => {
  it("keeps the call when the panel that started it unmounts", () => {
    function Panel() {
      useCallSession();
      return <p>panel</p>;
    }
    const view = render(
      <CallSessionProvider>
        <Probe />
        <Panel />
      </CallSessionProvider>
    );
    act(() => {
      s().startManual(manual);
    });
    // Another route: the case panel is gone, the provider stays.
    view.rerender(
      <CallSessionProvider>
        <Probe />
      </CallSessionProvider>
    );
    expect(view.queryByText("panel")).toBeNull();
    expect(s().call?.status).toBe("live");
    expect(s().call?.contactName).toBe("Synthetic contact");
  });

  it("allows one open call at a time", () => {
    mount();
    let second = true;
    act(() => {
      s().startManual(manual);
    });
    act(() => {
      second = s().startManual({ ...manual, key: "case-2:contact-2" });
    });
    expect(second).toBe(false);
    expect(s().call?.key).toBe("case-1:contact-1");
    expect(s().busy).toBe(true);
  });

  it("lets a failed browser call be replaced", async () => {
    mount();
    act(() => {
      s().startTelnyx({
        ...manual,
        destination: "+12025550101",
        token: vi.fn().mockRejectedValue(new Error("HTTP 500")),
        dial: vi.fn(),
        endCall: vi.fn(),
      });
    });
    await waitFor(() => expect(s().call?.status).toBe("failed"));
    expect(s().busy).toBe(false);
    act(() => {
      s().startManual({ ...manual, key: "case-2:contact-2" });
    });
    expect(s().call?.key).toBe("case-2:contact-2");
  });

  it("ends a timed call with its duration and keeps it for the form", () => {
    let now = 1_000_000;
    render(
      <CallSessionProvider now={() => now}>
        <Probe />
      </CallSessionProvider>
    );
    act(() => {
      s().startManual(manual);
    });
    now += 65_400;
    act(() => s().confirm());
    expect(s().call?.status).toBe("ended");
    expect(s().call?.result).toEqual({
      durationSeconds: 65,
      method: "phone",
      telephony: null,
    });
    act(() => s().clearIfOver("other-case"));
    expect(s().call).not.toBeNull();
    act(() => s().clearIfOver("case-1"));
    expect(s().call).toBeNull();
  });

  it("does not forget a live call when the panel closes", () => {
    mount();
    act(() => {
      s().startManual(manual);
    });
    act(() => s().clearIfOver("case-1"));
    expect(s().call?.status).toBe("live");
  });

  it("records a Teams call as pending on its connection", () => {
    mount();
    act(() => {
      s().startTeams({ ...manual, method: "teams", connectionId: "teams-1" });
    });
    act(() => s().confirm());
    expect(s().call?.result?.telephony).toMatchObject({
      provider: "TEAMS_PHONE",
      status: "PENDING",
      connectionId: "teams-1",
      calleeNumber: "+12025550101",
    });
  });

  it("restores a call outside the browser after a reload, timer included", () => {
    const first = mount();
    act(() => {
      s().startManual({ ...manual, method: "whatsapp" });
    });
    const startedAt = s().call?.startedAt;
    first.unmount();
    session = null;
    mount();
    expect(s().call).toMatchObject({
      status: "live",
      method: "whatsapp",
      startedAt,
      contactName: "Synthetic contact",
    });
    expect(s().call?.context.target?.stats?.lastCallAt).toBeInstanceOf(Date);
    expect(s().call?.context.script?.goal).toBe("Step goal");
  });

  it("stores a browser call without its login token", async () => {
    const { dial, token, endCall, opts } = browserCall();
    mount();
    act(() => {
      s().startTelnyx({
        ...manual,
        destination: "+12025550101",
        caseRef: "case-1",
        dial,
        token,
        endCall,
      });
    });
    await waitFor(() => expect(dial).toHaveBeenCalled());
    expect(opts()?.token).toBe("secret-login-token");
    act(() => {
      opts()?.onCallId?.("v3:control-1");
      opts()?.onPhase("active", 1_000);
    });
    await waitFor(() => expect(s().call?.dialReady).toBe(true));
    const stored = sessionStorage.getItem(CALL_SESSION_STORAGE_KEY) ?? "";
    expect(stored).toContain("ref-1");
    expect(stored).toContain("v3:control-1");
    expect(stored).not.toContain("secret-login-token");
  });

  it("shows a browser call as cut after a reload and frees its channel", async () => {
    const { dial, token, endCall, opts } = browserCall();
    const first = mount();
    act(() => {
      s().startTelnyx({
        ...manual,
        destination: "+12025550101",
        dial,
        token,
        endCall,
      });
    });
    await waitFor(() => expect(dial).toHaveBeenCalled());
    const answeredAt = Date.now() - 30_000;
    act(() => {
      opts()?.onCallId?.("v3:control-1");
      opts()?.onPhase("active", answeredAt);
    });
    await waitFor(() => expect(s().call?.answeredAt).toBe(answeredAt));
    // A reload: the page goes away without the call ending.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    first.unmount();
    session = null;
    const reloaded = mount();
    expect(s().call?.status).toBe("dropped");
    expect(reloaded.endCall).toHaveBeenCalledWith("ref-1", "v3:control-1");
    const result = s().call?.result;
    expect(result?.telephony).toMatchObject({
      provider: "TELNYX",
      answered: true,
      hangupCause: "PAGE_RELOAD",
      callId: "v3:control-1",
    });
    expect(result?.durationSeconds).toBeGreaterThanOrEqual(30);
    // "Registrar resultado" hands the cut call to the form.
    act(() => s().confirm());
    expect(s().call?.status).toBe("ended");
  });

  it("warns before leaving while a browser call is live", async () => {
    const { dial, token, endCall } = browserCall();
    mount();
    act(() => {
      s().startTelnyx({
        ...manual,
        destination: "+12025550101",
        dial,
        token,
        endCall,
      });
    });
    await waitFor(() => expect(dial).toHaveBeenCalled());
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not warn before leaving for a call outside the browser", () => {
    mount();
    act(() => {
      s().startManual(manual);
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("mutes, hangs up and releases a browser call", async () => {
    const { dial, token, endCall, live, opts } = browserCall();
    mount();
    act(() => {
      s().startTelnyx({
        ...manual,
        destination: "+12025550101",
        dial,
        token,
        endCall,
      });
    });
    await waitFor(() => expect(s().call?.dialReady).toBe(true));
    act(() => s().setMuted(true));
    expect(live.setMuted).toHaveBeenCalledWith(true);
    expect(s().call?.muted).toBe(true);
    act(() => s().confirm());
    expect(live.hangup).toHaveBeenCalled();
    act(() =>
      opts()?.onEnd({
        provider: "TELNYX",
        answered: true,
        durationSeconds: 12,
        hangupCause: "NORMAL_CLEARING",
        sipCode: 200,
        callId: "v3:control-1",
        calleeNumber: "+12025550101",
        startedAt: "2026-11-05T10:00:00.000Z",
      })
    );
    expect(endCall).toHaveBeenCalledWith("ref-1", "v3:control-1");
    expect(s().call?.status).toBe("ended");
    expect(s().call?.result?.durationSeconds).toBe(12);
  });
});
