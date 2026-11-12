import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import es from "@/lang/es.json";
import PrototypeInlineForm from "./prototype-inline-form";
import { forgetStartedTreatments } from "./prototype-api-guard";

const flow = vi.hoisted(() => ({
  onSkip: vi.fn<(step: number) => void>(),
}));
const tower = vi.hoisted(() => ({
  ControlTowerError: class extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  },
  openTreatment: vi.fn(),
  cancelTreatment: vi.fn(),
  revalidateCase: vi.fn(),
}));
const page = vi.hoisted(() => ({
  notify: vi.fn(),
  call: null as { status: string; context: { caseId: string } } | null,
  clearIfOver: vi.fn(),
}));
vi.mock("@/features/symptoms/control-tower/control-tower-api", () => tower);
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  getRuntimeConfig: () => ({}),
}));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: page.notify,
}));
vi.mock("./call-center/call-session", () => ({
  useOptionalCallSession: () => ({
    call: page.call,
    clearIfOver: page.clearIfOver,
  }),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("./prototype-record-handling", () => ({
  default: () => <p>Handling form</p>,
}));
vi.mock("./prototype-ignore-condition", () => ({ default: () => null }));
vi.mock("./prototype-invalidate-symptom", () => ({ default: () => null }));
vi.mock(
  "../../blurrable-stepped-menu/menus/whatsapp-contact/whatsapp-contact",
  () => ({ default: () => null })
);
vi.mock("./call-center/prototype-call-center-flow", () => ({
  default: ({
    skippedTo,
    onSkip,
    onCallStart,
  }: Readonly<{
    skippedTo: number | null;
    onSkip: (step: number) => void;
    onCallStart: () => void;
  }>) => {
    flow.onSkip.mockImplementation(onSkip);
    return (
      <>
        <output aria-label="Skipped step">{skippedTo ?? "none"}</output>
        <button onClick={() => onSkip(1)}>Skip</button>
        <button onClick={onCallStart}>Llamar</button>
      </>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  forgetStartedTreatments();
  page.call = null;
  tower.openTreatment.mockResolvedValue({ id: "t-1", actions: [] });
  tower.cancelTreatment.mockResolvedValue({});
});

function panel(
  id: number,
  level: number,
  since: string,
  selectedOption: SelectedOption = "call_driver",
  setIsMenuOpen: (open: boolean) => void = vi.fn()
) {
  const treatmentData = {
    symptom_info: { id, icu_code: level, sla_since: since },
    trip_info: {},
  } as TreatmentsGeneralResponseItem;
  return (
    <PrototypeInlineForm
      key={id}
      setIsMenuOpen={setIsMenuOpen}
      isMenuOpen={true}
      dict={es as I18nRecord}
      selectedOption={selectedOption}
      setSelectedOption={vi.fn()}
      treatmentData={treatmentData}
      treatments_templates={null}
    />
  );
}

describe("opening the engine-only handling form", () => {
  it.each([-7, 7])("shows the handling form for case %s", (id) => {
    render(panel(id, 3, "2026-11-05T12:00:00Z", "record_handling"));

    expect(screen.getByText("Handling form")).toBeInTheDocument();
  });
});

describe("local call-step progress", () => {
  it.each([
    [-7, 4, "2026-11-05T12:01:00Z", "a new level"],
    [-7, 3, "2026-11-05T12:01:00Z", "a resumed hold"],
    [-8, 3, "2026-11-05T12:00:00Z", "another case"],
  ])(
    "resets on %s/%s/%s (%s), including a late save response",
    (id, level, since) => {
      const view = render(panel(-7, 3, "2026-11-05T12:00:00Z"));
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      expect(screen.getByLabelText("Skipped step")).toHaveTextContent("1");
      const oldSave = flow.onSkip.getMockImplementation()!;
      view.rerender(panel(id, level, since));
      expect(screen.getByLabelText("Skipped step")).toHaveTextContent("none");
      act(() => oldSave(2));
      expect(screen.getByLabelText("Skipped step")).toHaveTextContent("none");
    }
  );
});

describe("the treatment behind the panel", () => {
  const SINCE = "2026-11-05T12:00:00Z";
  const opened = () =>
    waitFor(() => expect(tower.openTreatment).toHaveBeenCalledTimes(1));

  it.each<[SelectedOption, string]>([
    ["call_driver", "CALL"],
    ["record_handling", "CALL"],
    ["ignore_condition", "IGNORE_CONDITION"],
    ["invalidate_symptom", "INVALIDATE_SYMPTOM"],
  ])("opens when the panel opens on %s", async (option, type) => {
    render(panel(-7, 3, SINCE, option));

    await opened();
    expect(tower.openTreatment).toHaveBeenCalledWith("-7", {
      type,
      assetId: undefined,
      tripId: undefined,
    });
  });

  it("is not opened for a WhatsApp message", () => {
    render(panel(-7, 3, SINCE, "contact_via_whatsapp"));

    expect(tower.openTreatment).not.toHaveBeenCalled();
  });

  it("is not opened for a case outside the Control Tower", () => {
    render(panel(7, 3, SINCE));

    expect(tower.openTreatment).not.toHaveBeenCalled();
  });

  it("is opened by 'Llamar' when opening with the panel failed", async () => {
    tower.openTreatment.mockRejectedValueOnce(new Error("network"));
    render(panel(-7, 3, SINCE));
    await opened();
    await waitFor(() =>
      expect(page.notify).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.treatment_start_error,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Llamar" }));

    await waitFor(() => expect(tower.openTreatment).toHaveBeenCalledTimes(2));
  });

  it("is not opened twice by 'Llamar'", async () => {
    render(panel(-7, 3, SINCE));
    await opened();

    fireEvent.click(screen.getByRole("button", { name: "Llamar" }));
    await act(async () => {});

    expect(tower.openTreatment).toHaveBeenCalledTimes(1);
  });

  it("is cancelled when the panel closes with nothing recorded", async () => {
    const view = render(panel(-7, 3, SINCE));
    await opened();

    view.unmount();

    await waitFor(() =>
      expect(tower.cancelTreatment).toHaveBeenCalledWith(
        "t-1",
        "panel closed",
        { keepalive: false }
      )
    );
  });

  it("is cancelled when the page unloads with nothing recorded", async () => {
    render(panel(-7, 3, SINCE));
    await opened();

    globalThis.dispatchEvent(new Event("pagehide"));

    await waitFor(() =>
      expect(tower.cancelTreatment).toHaveBeenCalledWith(
        "t-1",
        "panel closed",
        { keepalive: true }
      )
    );
  });

  it.each(["live", "ended"])(
    "stays open while the case's call is %s in the call session",
    async (status) => {
      page.call = { status, context: { caseId: "-7" } };
      const view = render(panel(-7, 3, SINCE));
      await opened();

      globalThis.dispatchEvent(new Event("pagehide"));
      view.unmount();
      await act(async () => {});

      expect(tower.cancelTreatment).not.toHaveBeenCalled();
    }
  );

  it("is cancelled when the operator leaves the panel after the call ended", async () => {
    page.call = { status: "ended", context: { caseId: "-7" } };
    const view = render(panel(-7, 3, SINCE, "record_handling"));
    await opened();

    fireEvent.click(
      screen.getByRole("button", { name: es.symptoms.proto_back })
    );
    view.unmount();

    expect(page.clearIfOver).toHaveBeenCalledWith("-7");
    await waitFor(() => expect(tower.cancelTreatment).toHaveBeenCalled());
  });

  it("says the case is closed as the form opens, and closes it", async () => {
    tower.openTreatment.mockRejectedValue(
      new tower.ControlTowerError("the case is closed", 409)
    );
    const setIsMenuOpen = vi.fn();
    render(panel(-7, 3, SINCE, "call_driver", setIsMenuOpen));

    await waitFor(() =>
      expect(page.notify).toHaveBeenCalledWith({
        type: "error",
        message: es.symptoms.treatment_case_closed,
      })
    );
    expect(setIsMenuOpen).toHaveBeenCalledWith(false);
    expect(tower.revalidateCase).toHaveBeenCalledWith("-7");
  });

  it("closes without that message when another operator took the case", async () => {
    tower.openTreatment.mockRejectedValue(
      new tower.ControlTowerError("another operator is treating this case", 409)
    );
    const setIsMenuOpen = vi.fn();
    render(panel(-7, 3, SINCE, "call_driver", setIsMenuOpen));

    await waitFor(() => expect(setIsMenuOpen).toHaveBeenCalledWith(false));
    expect(page.notify).not.toHaveBeenCalled();
  });
});

describe("late treatment refusals", () => {
  it("does not close a new case panel when the old case is refused", async () => {
    let refuse!: (error: Error) => void;
    tower.openTreatment.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = reject;
      })
    );
    const close = vi.fn();
    const view = render(panel(-7, 3, "start", "call_driver", close));
    await waitFor(() => expect(tower.openTreatment).toHaveBeenCalledTimes(1));
    view.rerender(panel(-8, 3, "start", "call_driver", close));
    await act(async () =>
      refuse(new tower.ControlTowerError("the case is closed", 409))
    );
    expect(close).not.toHaveBeenCalled();
    expect(page.notify).not.toHaveBeenCalled();
  });

  it("does not notify after the panel unmounts", async () => {
    let refuse!: (error: Error) => void;
    tower.openTreatment.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = reject;
      })
    );
    const close = vi.fn();
    const view = render(panel(-7, 3, "start", "call_driver", close));
    await waitFor(() => expect(tower.openTreatment).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () =>
      refuse(new tower.ControlTowerError("the case is closed", 409))
    );
    expect(close).not.toHaveBeenCalled();
    expect(page.notify).not.toHaveBeenCalled();
  });
});
