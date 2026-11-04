/**
 * One browser call through Telnyx WebRTC. The SDK reports the call's state;
 * this turns it into the phases the dialing step shows and, once the call
 * ends, into what the CALL action records: answered or not, the seconds after
 * it was answered, the hangup cause and the provider's call id.
 */

export type CallPhase = "connecting" | "ringing" | "active" | "ended";

export interface TelephonyCallResult {
  provider: "TELNYX" | "TEAMS_PHONE";
  answered: boolean;
  durationSeconds: number;
  hangupCause: string | null;
  sipCode: number | null;
  /** Telnyx's call control id when it has one, else the SDK's call id. */
  callId: string | null;
  /** E.164, as dialed. */
  calleeNumber: string;
  startedAt: string;
}

/** What the CALL action keeps in `details.telephony`. */
export function telephonyDetails(
  result: TelephonyCallResult
): Record<string, unknown> {
  return {
    provider: result.provider,
    status: "RECORDED",
    callId: result.callId,
    hangupCause: result.hangupCause,
    sipCode: result.sipCode,
    calleeNumber: result.calleeNumber,
    startedAt: result.startedAt,
  };
}

/** The part of a Telnyx SDK call this module reads. */
interface SdkCall {
  id?: string;
  state?: string;
  cause?: string;
  sipCode?: number;
  telnyxIDs?: { telnyxCallControlId?: string };
  hangup(): Promise<void> | void;
}

/** The part of the Telnyx SDK client this module uses. */
export interface SdkClient {
  on(event: string, callback: (event: unknown) => void): unknown;
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
  newCall(options: {
    destinationNumber: string;
    callerNumber: string;
    audio: boolean;
    video: boolean;
    remoteElement?: HTMLMediaElement;
  }): SdkCall;
}

export type SdkFactory = (loginToken: string) => Promise<SdkClient>;

/** Loads `@telnyx/webrtc` only when a call starts. */
export const loadTelnyx: SdkFactory = async (loginToken) => {
  const { TelnyxRTC } = await import("@telnyx/webrtc");
  return new TelnyxRTC({ login_token: loginToken }) as unknown as SdkClient;
};

export interface StartCallOptions {
  token: string;
  callerNumber: string;
  /** E.164. */
  destination: string;
  remoteElement?: HTMLMediaElement | null;
  signal?: AbortSignal;
  onPhase: (phase: CallPhase, answeredAt: number | null) => void;
  onEnd: (result: TelephonyCallResult) => void;
  sdk?: SdkFactory;
  now?: () => number;
}

export interface LiveCall {
  /** Ends the call; `onEnd` still fires with the final state. */
  hangup(): void;
}

const RINGING = new Set(["ringing", "early"]);
const ENDED = new Set(["hangup", "destroy", "purge"]);

export async function startTelnyxCall({
  token,
  callerNumber,
  destination,
  remoteElement,
  signal,
  onPhase,
  onEnd,
  sdk = loadTelnyx,
  now = Date.now,
}: StartCallOptions): Promise<LiveCall> {
  const startedAt = now();
  let call: SdkCall | null = null;
  let answeredAt: number | null = null;
  let ended = false;
  let hangupAsked = false;
  const client = await sdk(token);

  const finish = (cause: string | null, sipCode: number | null) => {
    if (ended) return;
    ended = true;
    signal?.removeEventListener("abort", hangup);
    onPhase("ended", answeredAt);
    onEnd({
      provider: "TELNYX",
      answered: answeredAt !== null,
      durationSeconds:
        answeredAt === null ? 0 : Math.round((now() - answeredAt) / 1000),
      hangupCause: cause,
      sipCode,
      callId: call?.telnyxIDs?.telnyxCallControlId || call?.id || null,
      calleeNumber: destination,
      startedAt: new Date(startedAt).toISOString(),
    });
    try {
      void Promise.resolve(client.disconnect()).catch(() => undefined);
    } catch {
      // A synchronous SDK disconnect failure must not retain this call.
    }
  };

  function hangup() {
    if (ended || hangupAsked) return;
    hangupAsked = true;
    if (call) {
      try {
        void Promise.resolve(call.hangup()).catch(() =>
          finish("SDK_ERROR", null)
        );
      } catch {
        finish("SDK_ERROR", null);
      }
    } else finish("CANCELLED", null);
  }

  client.on("telnyx.ready", () => {
    if (ended || call) return;
    try {
      call = client.newCall({
        destinationNumber: destination,
        callerNumber,
        audio: true,
        video: false,
        remoteElement: remoteElement ?? undefined,
      });
    } catch {
      finish("SDK_ERROR", null);
    }
  });
  client.on("telnyx.error", () => finish("SDK_ERROR", null));
  client.on("telnyx.notification", (event) => {
    const n = event as { type?: string; call?: SdkCall };
    if (
      ended ||
      n.type !== "callUpdate" ||
      !n.call ||
      !call ||
      n.call.id !== call.id
    )
      return;
    call = n.call;
    const state = n.call.state ?? "";
    if (state === "active") {
      if (answeredAt === null) answeredAt = now();
      onPhase("active", answeredAt);
    } else if (RINGING.has(state)) {
      onPhase("ringing", null);
    } else if (ENDED.has(state)) {
      finish(n.call.cause ?? null, n.call.sipCode ?? null);
    }
  });
  signal?.addEventListener("abort", hangup, { once: true });
  if (signal?.aborted) {
    hangup();
    return { hangup };
  }
  onPhase("connecting", null);
  try {
    void Promise.resolve(client.connect()).catch(() =>
      finish("SDK_ERROR", null)
    );
  } catch {
    finish("SDK_ERROR", null);
  }
  return { hangup };
}
