import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import PrototypeCallCenterFlow, {
  type CallSnapshot,
} from "./prototype-call-center-flow";
import type { CallScript } from "./call-center-menu";
import type { CallTarget } from "./call-targets";

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
  }: {
    reason: string;
    channels?: { whatsapp?: string } | null;
    goal?: string;
    onCancel: () => void;
    onConfirm: (seconds: number, method: "phone" | "whatsapp") => void;
    line?: { provider: string } | null;
  }) => (
    <>
      <p>{reason}</p>
      <p>{channels?.whatsapp}</p>
      <p>{goal}</p>
      <span data-testid="phone-provider">{line?.provider ?? "manual"}</span>
      <button onClick={onCancel}>Cancel call</button>
      <button onClick={() => onConfirm(1, "phone")}>Confirm call</button>
      <button onClick={() => onConfirm(1, "whatsapp")}>Confirm WhatsApp</button>
    </>
  ),
}));
vi.mock("../prototype-call-driver", () => ({
  default: ({ onMakeAnotherCall }: { onMakeAnotherCall: () => void }) => (
    <button onClick={onMakeAnotherCall}>Another call</button>
  ),
}));
vi.mock("@/features/symptoms/control-tower/control-tower-api", () => ({
  contactsKey: "contacts",
  revalidateCase: vi.fn(),
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
}: Readonly<{
  snapshot?: CallSnapshot;
  onConfirmed?: (snapshot: CallSnapshot) => void;
  symptomId?: string;
}>) {
  const [message, setMessage] = useState(
    snapshot?.script?.message ?? "Default message"
  );
  return (
    <PrototypeCallCenterFlow
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
