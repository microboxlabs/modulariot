import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import PrototypeCallCenterFlow, {
  type CallSnapshot,
} from "./prototype-call-center-flow";
import type { CallScript } from "./call-center-menu";
import type { CallTarget } from "./call-targets";
import type { EngineTreatmentProgress } from "../prototype-api-guard";
import {
  CallSessionProvider,
  useCallSession,
  type CallSession,
} from "./call-session";
import { act } from "@testing-library/react";
import type { ReactElement } from "react";

const render = (ui: ReactElement) =>
  rtlRender(ui, { wrapper: CallSessionProvider });
beforeEach(() => sessionStorage.clear());

const target = vi.hoisted<CallTarget>(() => ({
  id: "contact-test",
  personName: "Synthetic contact",
  role: "Dispatcher",
  phone: "+12025550101",
  channels: { phone: "+12025550101", whatsapp: "+12025550102" },
  methods: ["phone"],
  stats: null,
}));

vi.mock("./call-center-menu", () => ({
  default: ({
    onCall,
  }: {
    onCall: (target: CallTarget, script?: CallScript) => void;
  }) => (
    <>
      <button
        onClick={() =>
          onCall(target, {
            message: "Step message",
            goal: "Step goal",
          })
        }
      >
        Step contact
      </button>
      <button onClick={() => onCall(target)}>Other contact</button>
    </>
  ),
}));
vi.mock("./call-dialing-step", () => ({
  default: ({
    reason,
    channels,
    goal,
    onCancel,
    onConfirm,
    line,
    sessionKey,
  }: {
    reason: string;
    channels?: { whatsapp?: string } | null;
    goal?: string;
    onCancel: () => void;
    onConfirm: (seconds: number, method: "phone" | "whatsapp") => void;
    line?: { provider: string } | null;
    sessionKey?: string;
  }) => (
    <>
      <p>{reason}</p>
      <p>{channels?.whatsapp}</p>
      <p>{goal}</p>
      <span data-testid="phone-provider">{line?.provider ?? "manual"}</span>
      <span data-testid="session-key">{sessionKey}</span>
      <button onClick={onCancel}>Cancel call</button>
      <button onClick={() => onConfirm(1, "phone")}>Confirm call</button>
      <button onClick={() => onConfirm(1, "whatsapp")}>Confirm WhatsApp</button>
    </>
  ),
}));
vi.mock("../prototype-call-driver", () => ({
  default: ({
    onMakeAnotherCall,
    initialCallTargetPhone,
    treatmentProgress,
  }: {
    onMakeAnotherCall: () => void;
    initialCallTargetPhone?: string;
    treatmentProgress: EngineTreatmentProgress;
  }) => (
    <>
      <span data-testid="result-phone">{initialCallTargetPhone}</span>
      <span data-testid="treatment-id">
        {treatmentProgress.pendingClose?.treatmentId ?? "none"}
      </span>
      <button
        onClick={() => {
          treatmentProgress.pendingClose = {
            symptomId: "-1",
            treatmentId: "t-1",
          };
          onMakeAnotherCall();
        }}
      >
        Another call
      </button>
    </>
  ),
}));
vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  contactsKey: "contacts",
  revalidateCase: vi.fn(),
  ControlTowerError: class extends Error {},
}));
vi.mock("swr", () => ({ mutate: vi.fn() }));
const telephony = vi.hoisted(() => ({
  data: {
    active: {
      connectionId: "t1",
      provider: "TELNYX",
      name: "Central",
      callerNumber: "+12025550101",
      ready: true,
    },
    preferred: null,
    lines: [],
  },
  error: undefined,
}));
vi.mock("@/features/symptoms/control-tower/telephony-api", () => ({
  useTelephony: () => telephony,
  fetchWebRtcToken: vi.fn(),
  reportCallEnded: vi.fn().mockResolvedValue(undefined),
  QUOTA_EXHAUSTED: "telephony_quota_exhausted",
  CHANNELS_BUSY: "telephony_channels_busy",
}));

const request: TreatmentsRequest = {
  asset_id: "test-asset",
  assigned_to: "operator@example.test",
  client_id: null,
  status: "active",
  symptom_id: "-1",
  treatment_type: "",
  treatment_id: null,
  trip_id: "test-trip",
};
function Flow({
  snapshot,
  onConfirmed = vi.fn(),
  symptomId = "-1",
  onCallStart,
}: Readonly<{
  snapshot?: CallSnapshot;
  onConfirmed?: (snapshot: CallSnapshot) => void;
  symptomId?: string;
  onCallStart?: () => Promise<boolean>;
}>) {
  const [message, setMessage] = useState(
    snapshot?.script?.message ?? "Default message"
  );
  return (
    <PrototypeCallCenterFlow
      onCallStart={onCallStart}
      dict={{}}
      treatmentData={null}
      messageToCommunicate={message}
      setMessageToCommunicate={setMessage}
      treatmentRequest={{ ...request, symptom_id: symptomId }}
      setTreatmentRequest={vi.fn()}
      setIsMenuOpen={vi.fn()}
      skippedTo={null}
      onSkip={vi.fn()}
      resumeSnapshot={snapshot}
      onCallConfirmed={onConfirmed}
    />
  );
}

describe("call step scripts", () => {
  it("keeps the treatment when another call remounts the results form", () => {
    render(<Flow />);
    fireEvent.click(screen.getByText("Step contact"));
    fireEvent.click(screen.getByText("Confirm call"));
    expect(screen.getByTestId("treatment-id")).toHaveTextContent("none");
    fireEvent.click(screen.getByText("Another call"));
    fireEvent.click(screen.getByText("Other contact"));
    fireEvent.click(screen.getByText("Confirm call"));
    expect(screen.getByTestId("treatment-id")).toHaveTextContent("t-1");
  });

  it.each([
    ["-1", "TELNYX"],
    ["42", "manual"],
  ])(
    "uses a provider only when case %s can persist the result",
    (symptomId, expected) => {
      render(<Flow symptomId={symptomId} />);
      fireEvent.click(screen.getByText("Step contact"));
      expect(screen.getByTestId("phone-provider")).toHaveTextContent(expected);
    }
  );

  it("restores the default message when the next contact has no step script", () => {
    render(<Flow />);
    fireEvent.click(screen.getByText("Step contact"));
    expect(screen.getByText("Step message")).toBeTruthy();
    expect(screen.getByText("+12025550102")).toBeTruthy();
    expect(screen.getByText("Step goal")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel call"));
    fireEvent.click(screen.getByText("Other contact"));
    expect(screen.getByText("Default message")).toBeTruthy();
    expect(screen.queryByText("Step goal")).toBeNull();
  });

  it("records the selected channel's phone in the confirmed snapshot", () => {
    const confirmed = vi.fn();
    render(<Flow onConfirmed={confirmed} />);
    fireEvent.click(screen.getByText("Step contact"));
    fireEvent.click(screen.getByText("Confirm WhatsApp"));
    expect(confirmed).toHaveBeenCalledWith(
      expect.objectContaining({ methodUsed: "whatsapp", phone: "+12025550102" })
    );
  });

  it("preserves the script and default across a completed-call remount", () => {
    const confirmed = vi.fn();
    const view = render(<Flow onConfirmed={confirmed} />);
    fireEvent.click(screen.getByText("Step contact"));
    fireEvent.click(screen.getByText("Confirm call"));
    const snapshot = confirmed.mock.calls[0]?.[0] as CallSnapshot;
    expect(snapshot.script?.goal).toBe("Step goal");
    view.unmount();
    render(<Flow snapshot={snapshot} />);
    fireEvent.click(screen.getByText("Another call"));
    fireEvent.click(screen.getByText("Other contact"));
    expect(screen.getByText("Default message")).toBeTruthy();
  });
});

describe("the call session", () => {
  let session: CallSession | null = null;
  function Probe() {
    session = useCallSession();
    return null;
  }
  function Host({ show }: Readonly<{ show: boolean }>) {
    return (
      <>
        <Probe />
        {show && <Flow />}
      </>
    );
  }
  const startCall = () =>
    act(() => {
      session?.startManual({
        key: ":contact-test",
        context: {
          caseId: null,
          target,
          script: { message: "Step message", goal: "Step goal" },
          defaultMessage: "Default message",
          message: "Step message",
        },
        contactName: target.personName,
        contactRole: target.role,
        method: "phone",
      });
    });

  const startIncoming = () =>
    act(() => {
      session?.startManual({
        key: "wa-in:incoming-1",
        context: { caseId: null },
        contactName: "Incoming contact",
        contactRole: "",
        method: "whatsapp",
        calleeNumber: "+12025550103",
      });
    });

  it("adopts an incoming session's key when opening its case", () => {
    const view = render(<Host show={false} />);
    startIncoming();
    view.rerender(<Host show />);
    expect(screen.getByTestId("session-key")).toHaveTextContent(
      "wa-in:incoming-1"
    );
  });

  it("preserves the incoming caller number when restoring a completed call", () => {
    const view = render(<Host show={false} />);
    startIncoming();
    act(() => session?.confirm());
    view.rerender(<Host show />);
    expect(screen.getByTestId("result-phone")).toHaveTextContent(
      "+12025550103"
    );
  });

  it("reopens the dialing step of the case's open call", () => {
    const view = render(<Host show={false} />);
    startCall();
    view.rerender(<Host show />);
    expect(screen.getByText("Step message")).toBeTruthy();
    expect(screen.getByText("Step goal")).toBeTruthy();
    expect(screen.queryByText("Step contact")).toBeNull();
  });

  it("opens the results form for a call that ended elsewhere", () => {
    const view = render(<Host show={false} />);
    startCall();
    act(() => session?.confirm());
    view.rerender(<Host show />);
    expect(screen.getByText("Another call")).toBeTruthy();
    fireEvent.click(screen.getByText("Another call"));
    expect(session?.call).toBeNull();
  });
});

it("waits for treatment ownership before showing the dialing step", async () => {
  let opened!: (ok: boolean) => void;
  render(
    <Flow
      onCallStart={() =>
        new Promise((resolve) => {
          opened = resolve;
        })
      }
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Other contact" }));
  expect(screen.queryByRole("button", { name: "Confirm call" })).toBeNull();
  await act(async () => opened(true));
  expect(
    screen.getByRole("button", { name: "Confirm call" })
  ).toBeInTheDocument();
});

it("does not dial when opening the treatment is refused", async () => {
  render(<Flow onCallStart={async () => false} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Other contact" }))
  );
  expect(screen.queryByRole("button", { name: "Confirm call" })).toBeNull();
});
