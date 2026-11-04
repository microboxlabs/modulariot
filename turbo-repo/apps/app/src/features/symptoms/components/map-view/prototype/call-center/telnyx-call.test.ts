import { describe, expect, it, vi } from "vitest";
import {
  startTelnyxCall,
  type SdkClient,
  type TelephonyCallResult,
} from "./telnyx-call";

/** A fake SDK client that lets the test fire its events. */
function fakeClient() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const call = {
    id: "sdk-1",
    state: "new",
    cause: undefined as string | undefined,
    sipCode: undefined as number | undefined,
    telnyxIDs: { telnyxCallControlId: "v3:control-1" },
    hangup: vi.fn(),
  };
  const client: SdkClient & { fire: (e: string, v?: unknown) => void } = {
    on: (event, cb) => {
      handlers[event] = cb;
      return client;
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    newCall: vi.fn(() => call),
    fire: (event, value) => handlers[event]?.(value),
  };
  const update = (state: string, cause?: string, sipCode?: number) => {
    call.state = state;
    call.cause = cause;
    call.sipCode = sipCode;
    client.fire("telnyx.notification", { type: "callUpdate", call });
  };
  return { client, call, update };
}

describe("startTelnyxCall", () => {
  it("returns a cancellable handle while connection startup is pending", async () => {
    const { client } = fakeClient();
    client.connect = vi.fn(() => new Promise<void>(() => undefined));
    const onEnd = vi.fn();
    const live = await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      onPhase: vi.fn(),
      onEnd,
      sdk: async () => client,
    });
    live.hangup();
    client.fire("telnyx.ready");
    expect(client.newCall).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ hangupCause: "CANCELLED" })
    );
  });

  it("disconnects and reports a rejected SDK connection", async () => {
    const { client } = fakeClient();
    client.connect = vi.fn().mockRejectedValue(new Error("socket refused"));
    const onEnd = vi.fn();
    await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      onPhase: vi.fn(),
      onEnd,
      sdk: async () => client,
    });
    await Promise.resolve();
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ callId: null, hangupCause: "SDK_ERROR" })
    );
    expect(client.disconnect).toHaveBeenCalled();
  });

  it("does not connect when the step was cancelled during SDK loading", async () => {
    const { client } = fakeClient();
    const abort = new AbortController();
    const onEnd = vi.fn();
    const live = await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      signal: abort.signal,
      onPhase: vi.fn(),
      onEnd,
      sdk: async () => {
        abort.abort();
        return client;
      },
    });
    live.hangup();
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.newCall).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("handles a synchronous SDK call-creation error", async () => {
    const { client } = fakeClient();
    client.newCall = vi.fn(() => {
      throw new Error("no microphone");
    });
    const onEnd = vi.fn();
    await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      onPhase: vi.fn(),
      onEnd,
      sdk: async () => client,
    });
    expect(() => client.fire("telnyx.ready")).not.toThrow();
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ callId: null, hangupCause: "SDK_ERROR" })
    );
    expect(client.disconnect).toHaveBeenCalled();
  });

  it("records the seconds after the answer and the call id", async () => {
    const { client, update } = fakeClient();
    let clock = 1_000;
    const phases: string[] = [];
    const ended: TelephonyCallResult[] = [];
    await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      onPhase: (p) => phases.push(p),
      onEnd: (r) => ended.push(r),
      sdk: async () => client,
      now: () => clock,
    });
    client.fire("telnyx.ready");
    expect(client.newCall).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationNumber: "+56911111111",
        callerNumber: "+56900000000",
        audio: true,
      })
    );
    update("ringing");
    clock = 5_000;
    update("active");
    clock = 47_400;
    update("hangup", "NORMAL_CLEARING", 200);
    update("destroy");

    expect(phases).toEqual(["connecting", "ringing", "active", "ended"]);
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({
      provider: "TELNYX",
      answered: true,
      durationSeconds: 42,
      hangupCause: "NORMAL_CLEARING",
      sipCode: 200,
      callId: "v3:control-1",
      calleeNumber: "+56911111111",
    });
    expect(client.disconnect).toHaveBeenCalled();
  });

  it("an unanswered call lasts zero seconds", async () => {
    const { client, update } = fakeClient();
    const ended: TelephonyCallResult[] = [];
    await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      onPhase: () => undefined,
      onEnd: (r) => ended.push(r),
      sdk: async () => client,
    });
    client.fire("telnyx.ready");
    update("ringing");
    update("hangup", "USER_BUSY", 486);
    expect(ended[0]).toMatchObject({
      answered: false,
      durationSeconds: 0,
      hangupCause: "USER_BUSY",
    });
  });

  it("hanging up before the client is ready ends the call", async () => {
    const { client } = fakeClient();
    const ended: TelephonyCallResult[] = [];
    const live = await startTelnyxCall({
      token: "jwt",
      callerNumber: "+56900000000",
      destination: "+56911111111",
      onPhase: () => undefined,
      onEnd: (r) => ended.push(r),
      sdk: async () => client,
    });
    live.hangup();
    expect(ended[0]).toMatchObject({
      answered: false,
      hangupCause: "CANCELLED",
    });
    client.fire("telnyx.ready");
    expect(client.newCall).not.toHaveBeenCalled();
  });
});
