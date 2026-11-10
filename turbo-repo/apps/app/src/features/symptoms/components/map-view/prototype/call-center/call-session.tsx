"use client";

/**
 * The operator's active call, held above the pages (mounted by the secured
 * layout) so it survives the case panel closing, the map taking the focus,
 * a route change and, for calls outside the browser, a reload.
 *
 * A browser call (Telnyx) lives here too: its SDK client, the hang-up handle
 * and the <audio> element that plays the callee. A reload kills that WebRTC
 * leg; the restored call is shown as cut ("dropped") so the operator can
 * record its result or call again.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  KNOWN_REFUSALS,
  fetchCallOutcome,
  fetchWebRtcToken,
  reportCallEnded,
} from "@/features/symptoms/control-tower/telephony-api";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import type { CallMethod } from "./call-method";
import {
  dropAfterReload,
  loadCall,
  saveCall,
  CALL_SESSION_STORAGE_KEY,
  type ActiveCall,
  type CallContext,
  type CallKind,
} from "./call-session-store";
import {
  pendingTeamsCall,
  startTelnyxCall,
  type LiveCall,
} from "./telnyx-call";

export type { ActiveCall, CallContext, CallStatus } from "./call-session-store";

export interface StartCall {
  key: string;
  context?: Partial<CallContext>;
  contactName: string;
  contactRole: string;
  method: CallMethod;
  calleeNumber?: string | null;
}

export interface StartTelnyx extends StartCall {
  destination: string;
  caseRef?: string | null;
  /** WHATSAPP: the server calls the number on WhatsApp and bridges it to this browser leg. */
  channel?: "WHATSAPP";
  dial?: typeof startTelnyxCall;
  token?: typeof fetchWebRtcToken;
  endCall?: typeof reportCallEnded;
  /** Why the provider ended a WhatsApp call that never connected. */
  outcome?: typeof fetchCallOutcome;
}

export interface CallSession {
  call: ActiveCall | null;
  /** A call that is not over yet blocks starting another one. */
  busy: boolean;
  startManual(input: StartCall & { notice?: string | null }): boolean;
  startTeams(input: StartCall & { connectionId: string }): boolean;
  startTelnyx(input: StartTelnyx): boolean;
  /** "Marcar como realizada": ends the call and keeps its result for the form. */
  confirm(): void;
  /** Ends the call without a result. */
  cancel(): void;
  /** Forgets the call once its result is recorded (or it is abandoned). */
  clear(): void;
  /** Forgets an ended call of this case; a live call stays. */
  clearIfOver(caseId: string | null): void;
  setMuted(muted: boolean): void;
  /** Asks the case page to show the call; `focusTick` changes on each ask. */
  requestFocus(): void;
  focusTick: number;
}

const CallSessionContext = createContext<CallSession | null>(null);

export function useCallSession(): CallSession {
  const session = useContext(CallSessionContext);
  if (!session)
    throw new Error("useCallSession needs a CallSessionProvider above it");
  return session;
}

/** The same, for components that also render outside the provider. */
export function useOptionalCallSession(): CallSession | null {
  return useContext(CallSessionContext);
}

/** Seconds shown for the call: from the answer for a browser call, from the press otherwise. */
export function callSeconds(call: ActiveCall, now: number): number {
  if (call.status !== "live") return call.result?.durationSeconds ?? 0;
  if (call.kind === "telnyx")
    return call.answeredAt === null
      ? 0
      : Math.max(0, Math.floor((now - call.answeredAt) / 1000));
  return Math.max(0, Math.floor((now - call.startedAt) / 1000));
}

/** Re-renders every `ms` while `active`, returning the current time. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

const EMPTY_CONTEXT: CallContext = {
  caseId: null,
  caseHref: null,
  caseLabel: null,
  target: null,
  script: null,
  defaultMessage: "",
  message: "",
};

interface Engine {
  id: string;
  live: LiveCall | null;
  abort: AbortController | null;
  release: (() => void) | null;
  cancelled: boolean;
}

/**
 * The server records Meta's refusal while it hangs up the operator's leg, so
 * the browser can see the hangup first: ask once more a moment later.
 */
export async function whatsAppFailure(
  outcome: typeof fetchCallOutcome,
  callRef: string,
  retryMs = 1500
): Promise<string | null> {
  const first = await outcome(callRef);
  if (first.failure) return first.failure;
  await new Promise((resolve) => setTimeout(resolve, retryMs));
  return (await outcome(callRef)).failure;
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Only restore calls belonging to the signed-in operator and active organization. */
export function ScopedCallSessionProvider({
  userId,
  children,
}: Readonly<PropsWithChildren<{ userId: string }>>) {
  const { activeOrg } = useOrgScopes();
  const storageKey =
    userId && activeOrg
      ? `${CALL_SESSION_STORAGE_KEY}:${JSON.stringify([userId, activeOrg.slug])}`
      : null;
  return (
    <CallSessionProvider key={storageKey} storageKey={storageKey}>
      {children}
    </CallSessionProvider>
  );
}

export function CallSessionProvider({
  children,
  endCall: releaseAfterReload = reportCallEnded,
  now = Date.now,
  storageKey = CALL_SESSION_STORAGE_KEY,
}: Readonly<
  PropsWithChildren<{
    /** Test seam: frees a browser call's channel after a reload. */
    endCall?: typeof reportCallEnded;
    now?: () => number;
    /** Null while the operator's organization is unresolved: do not restore or start a call. */
    storageKey?: string | null;
  }>
>) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const callRef = useRef<ActiveCall | null>(null);
  callRef.current = call;
  const engine = useRef<Engine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Restore after a reload. A browser call did not survive it: free its
  // channel (the server ignores this once Telnyx admitted the call) and show it as cut.
  useEffect(() => {
    const stored = storageKey ? loadCall(storageKey) : null;
    if (stored) {
      const restored = dropAfterReload(stored, now());
      if (
        restored.status === "dropped" &&
        stored.status === "live" &&
        stored.callRef
      )
        void releaseAfterReload(stored.callRef, stored.providerCallId).catch(
          () => undefined
        );
      setCall(restored);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated && storageKey) saveCall(call, storageKey);
  }, [call, hydrated, storageKey]);

  const liveBrowserCall = call?.kind === "telnyx" && call.status === "live";
  useEffect(() => {
    if (!liveBrowserCall) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // Stamps when the page was left, so a restored call's time stops there.
    const left = () => {
      const current = callRef.current;
      if (current && storageKey)
        saveCall({ ...current, leftAt: Date.now() }, storageKey);
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", left);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", left);
    };
  }, [liveBrowserCall, storageKey]);

  const stopEngine = useCallback(() => {
    const eng = engine.current;
    engine.current = null;
    if (!eng) return;
    eng.cancelled = true;
    eng.abort?.abort();
    eng.release?.();
    eng.live?.hangup();
  }, []);

  // Leaving the app (the provider unmounts) ends a call still on the line.
  useEffect(() => stopEngine, [stopEngine]);

  const patch = useCallback((id: string, fields: Partial<ActiveCall>) => {
    setCall((prev) => (prev && prev.id === id ? { ...prev, ...fields } : prev));
  }, []);

  const canStart = () => {
    if (!storageKey) return false;
    const current = callRef.current;
    return !current || current.status === "failed";
  };

  const begin = (
    input: StartCall,
    kind: CallKind,
    extra: Partial<ActiveCall> = {}
  ): ActiveCall => {
    stopEngine();
    const next: ActiveCall = {
      id: newId(),
      key: input.key,
      context: { ...EMPTY_CONTEXT, ...input.context },
      contactName: input.contactName,
      contactRole: input.contactRole,
      method: input.method,
      kind,
      status: "live",
      startedAt: now(),
      phase: null,
      answeredAt: null,
      dialReady: kind !== "telnyx",
      callRef: null,
      providerCallId: null,
      calleeNumber: input.calleeNumber ?? null,
      teamsConnectionId: null,
      notice: null,
      error: null,
      result: null,
      muted: false,
      leftAt: null,
      ...extra,
    };
    callRef.current = next;
    setCall(next);
    return next;
  };

  const startManual: CallSession["startManual"] = (input) => {
    if (!canStart()) return false;
    begin(input, "manual", { notice: input.notice ?? null });
    return true;
  };

  const startTeams: CallSession["startTeams"] = (input) => {
    if (!canStart()) return false;
    begin(input, "teams", { teamsConnectionId: input.connectionId });
    return true;
  };

  const startTelnyx: CallSession["startTelnyx"] = (input) => {
    if (!canStart()) return false;
    const {
      destination,
      caseRef,
      channel,
      dial = startTelnyxCall,
      token = fetchWebRtcToken,
      endCall = reportCallEnded,
      outcome = fetchCallOutcome,
    } = input;
    const started = begin(input, "telnyx", {
      phase: "connecting",
      calleeNumber: destination,
    });
    const id = started.id;
    const eng: Engine = {
      id,
      live: null,
      abort: new AbortController(),
      release: null,
      cancelled: false,
    };
    engine.current = eng;
    let acquiredRef: string | null = null;
    let released = false;
    let ended = false;
    const release = (callId: string | null = null) => {
      if (released || !acquiredRef) return;
      released = true;
      void endCall(acquiredRef, callId).catch(() => undefined);
    };
    eng.release = release;
    void (async () => {
      try {
        const login = await token({
          calleeNumber: destination,
          caseRef: caseRef ?? undefined,
          ...(channel ? { channel } : {}),
        });
        acquiredRef = login.callRef ?? null;
        if (eng.cancelled) {
          release();
          return;
        }
        patch(id, { callRef: acquiredRef });
        const live = await dial({
          token: login.token,
          callerNumber: login.callerNumber,
          destination,
          remoteElement: audioRef.current,
          clientState: acquiredRef ? btoa(acquiredRef) : undefined,
          signal: eng.abort?.signal,
          onPhase: (next, at) => patch(id, { phase: next, answeredAt: at }),
          onCallId: (callId) => patch(id, { providerCallId: callId }),
          onEnd: (result) => {
            ended = true;
            eng.live = null;
            release(result.callId);
            if (eng.cancelled) return;
            if (engine.current === eng) engine.current = null;
            if (!result.callId) {
              patch(id, {
                status: "failed",
                phase: null,
                dialReady: false,
                error: { refusal: null, message: null },
              });
              return;
            }
            const finish = () =>
              patch(id, {
                status: "ended",
                phase: "ended",
                dialReady: false,
                providerCallId: result.callId,
                result: {
                  durationSeconds: result.durationSeconds,
                  method: input.method,
                  telephony: result,
                },
              });
            // A WhatsApp call that never connected may have been refused by
            // Meta (no call permission): the server kept why.
            if (channel !== "WHATSAPP" || result.answered || !acquiredRef) {
              finish();
              return;
            }
            void whatsAppFailure(outcome, acquiredRef)
              .then((failure) => {
                if (!failure) return finish();
                patch(id, {
                  status: "failed",
                  phase: null,
                  dialReady: false,
                  providerCallId: result.callId,
                  error: { refusal: failure, message: null },
                });
              })
              .catch(finish);
          },
        });
        if (!ended) eng.live = live;
        if (eng.cancelled) {
          live.hangup();
          return;
        }
        if (!ended) patch(id, { dialReady: true });
      } catch (cause) {
        release();
        if (eng.cancelled) return;
        if (engine.current === eng) engine.current = null;
        const code =
          cause instanceof ControlTowerError ? cause.code : undefined;
        patch(id, {
          status: "failed",
          phase: null,
          dialReady: false,
          error: {
            refusal: code && KNOWN_REFUSALS.includes(code) ? code : null,
            message: cause instanceof Error ? cause.message : String(cause),
          },
        });
      }
    })();
    return true;
  };

  const confirm = () => {
    const current = callRef.current;
    if (!current) return;
    if (current.status === "dropped") {
      patch(current.id, { status: "ended" });
      return;
    }
    if (current.status !== "live") return;
    if (current.kind === "telnyx") {
      // The end arrives through onEnd with the provider's result.
      engine.current?.live?.hangup();
      return;
    }
    const at = now();
    const durationSeconds = Math.max(
      0,
      Math.floor((at - current.startedAt) / 1000)
    );
    patch(current.id, {
      status: "ended",
      result: {
        durationSeconds,
        method: current.method,
        telephony:
          current.kind === "teams"
            ? pendingTeamsCall(
                current.calleeNumber ?? "",
                current.startedAt,
                at,
                current.teamsConnectionId ?? undefined
              )
            : null,
      },
    });
  };

  const cancel = () => {
    stopEngine();
    callRef.current = null;
    setCall(null);
  };

  const clear = cancel;

  const clearIfOver = (caseId: string | null) => {
    const current = callRef.current;
    if (!current || current.status === "live") return;
    if (caseId !== null && current.context.caseId !== caseId) return;
    cancel();
  };

  const setMuted = (muted: boolean) => {
    const current = callRef.current;
    const live = engine.current?.live;
    if (!current || current.phase === "connecting" || !live?.setMuted) return;
    live.setMuted(muted);
    patch(current.id, { muted });
  };

  const requestFocus = () => setFocusTick((t) => t + 1);

  const busy = call !== null && call.status !== "failed";
  const value: CallSession = {
    call,
    busy,
    startManual,
    startTeams,
    startTelnyx,
    confirm,
    cancel,
    clear,
    clearIfOver,
    setMuted,
    requestFocus,
    focusTick,
  };
  // Actions read refs, so the object only needs to change with the state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memo = useMemo(() => value, [call, focusTick]);

  return (
    <CallSessionContext.Provider value={memo}>
      {/* The callee's voice in a browser call, kept across pages. */}
      <audio ref={audioRef} autoPlay className="hidden" />
      {children}
    </CallSessionContext.Provider>
  );
}
