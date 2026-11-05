import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallDialingStep from "./call-dialing-step";
import { ControlTowerError } from "@/features/symptoms/control-tower/control-tower-api";
import type { StartCallOptions, TelephonyCallResult } from "./telnyx-call";

const { request } = vi.hoisted(() => ({
  request: vi.fn().mockResolvedValue({
    callingEnabled: false,
    state: "NO_PERMISSION",
    permission: "NONE",
    canRequest: false,
    expiresAt: null,
    lastRequestAt: null,
    refusal: "CALLING_DISABLED",
    nextRequestAt: null,
  }),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
// WhatsApp calling off: the permission row stays hidden.
vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    controlTowerRequest: request,
  })
);

const dict = es as unknown as I18nRecord;

function renderStep(
  allowedMethods: ("phone" | "whatsapp" | "meet" | "teams")[],
  contactId?: string
) {
  render(
    <CallDialingStep
      dict={dict}
      contactName="Luis"
      contactRole="Transportista"
      allowedMethods={allowedMethods}
      contactId={contactId}
      reason=""
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />
  );
}

describe("CallDialingStep", () => {
  it.each(["TELNYX", "TEAMS_PHONE"] as const)(
    "keeps emergency calls recordable while %s is configured",
    (provider) => {
      const onConfirm = vi.fn();
      const openTeams = vi.fn();
      const token = vi.fn();
      render(
        <CallDialingStep
          dict={dict}
          contactName="Carabineros"
          contactRole="Emergencias – Carabineros"
          contactPhone="133"
          allowedMethods={["phone"]}
          reason=""
          line={{
            connectionId: "test",
            provider,
            name: "Central",
            callerNumber: "+56900000000",
            ready: true,
          }}
          telephonyFailed
          openTeams={openTeams}
          token={token}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      expect(openTeams).not.toHaveBeenCalled();
      expect(token).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
      );
      expect(onConfirm).toHaveBeenCalledWith(expect.any(Number), "phone");
    }
  );

  it("opens the channel-specific WhatsApp recipient", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <CallDialingStep
        dict={dict}
        contactName="Synthetic contact"
        contactRole="Dispatcher"
        contactPhone="+12025550101"
        channels={{ phone: "+12025550101", whatsapp: "+12025550102" }}
        allowedMethods={["phone", "whatsapp"]}
        reason="Step message"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
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

  it("displays the selected WhatsApp channel's number", () => {
    render(
      <CallDialingStep
        dict={dict}
        contactName="Luis"
        contactRole="Conductor"
        contactPhone="+12025550101"
        channels={{ whatsapp: "+12025550103" }}
        allowedMethods={["whatsapp"]}
        reason=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Llamada por WhatsApp" })
    );
    expect(screen.getByText(/202.*555.*0103/)).toBeTruthy();
    expect(screen.queryByText(/202.*555.*0101/)).toBeNull();
  });
  it("offers only the contact's channels", () => {
    renderStep(["whatsapp"]);
    expect(
      screen.getByRole("button", { name: "Llamada por WhatsApp" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Llamada telefónica" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Llamada por Microsoft Teams" })
    ).toBeNull();
  });

  it("confirms the selected WhatsApp method", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const confirm = vi.fn();
    render(
      <CallDialingStep
        dict={dict}
        contactName="Synthetic contact"
        contactRole="Dispatcher"
        channels={{ whatsapp: "+12025550102" }}
        allowedMethods={["whatsapp"]}
        reason=""
        onCancel={vi.fn()}
        onConfirm={confirm}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Llamada por WhatsApp" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
    );
    expect(confirm).toHaveBeenCalledWith(expect.any(Number), "whatsapp");
    open.mockRestore();
  });

  it("says so when the contact has no channel, and links to edit it", () => {
    renderStep([], "c1");
    expect(screen.getByText("Sin canales registrados")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "Editar contacto" }).getAttribute("href")
    ).toBe("/es/users/settings/contact-book?edit=c1");
  });

  it("has no edit link for someone outside the book", () => {
    renderStep([]);
    expect(screen.getByText("Sin canales registrados")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  describe("with a Telnyx line", () => {
    it.each(["loading", "failed"])(
      "does not fall back to the dialer while setup is %s",
      (state) => {
        render(
          <CallDialingStep
            dict={dict}
            contactName="Luis"
            contactRole="Driver"
            contactPhone="+56911111111"
            allowedMethods={["phone"]}
            reason=""
            telephonyPending={state === "loading"}
            telephonyFailed={state === "failed"}
            onCancel={vi.fn()}
            onConfirm={vi.fn()}
          />
        );
        expect(
          screen.getByRole("button", { name: "Llamada telefónica" })
        ).toBeDisabled();
        expect(
          screen.getByRole(state === "failed" ? "alert" : "status")
        ).toBeTruthy();
      }
    );

    it("does not record a manually timed call while the token is pending", () => {
      const onConfirm = vi.fn();
      render(
        <CallDialingStep
          dict={dict}
          contactName="Luis"
          contactRole="Driver"
          contactPhone="+56911111111"
          allowedMethods={["phone"]}
          reason=""
          line={{
            connectionId: "t1",
            provider: "TELNYX",
            name: "Central",
            callerNumber: "+56900000000",
            ready: true,
          }}
          token={() => new Promise(() => undefined)}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      const confirm = screen.getByRole("button", {
        name: es.symptoms.call_modal_confirm,
      });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    const line = {
      connectionId: "t1",
      provider: "TELNYX" as const,
      name: "Central",
      callerNumber: "+56900000000",
      ready: true,
    };
    const result: TelephonyCallResult = {
      provider: "TELNYX",
      answered: true,
      durationSeconds: 42,
      hangupCause: "NORMAL_CLEARING",
      sipCode: 200,
      callId: "v3:control-1",
      calleeNumber: "+56911111111",
      startedAt: "2026-11-04T10:00:00.000Z",
    };

    function renderTelnyx(contactPhone = "+56 9 1111 1111") {
      let options: StartCallOptions | null = null;
      const hangup = vi.fn(() => options?.onEnd(result));
      const dial = vi.fn(async (o: StartCallOptions) => {
        options = o;
        return { hangup };
      });
      const token = vi.fn().mockResolvedValue({
        token: "jwt",
        callerNumber: "+56900000000",
        expiresAt: "2026-11-05T10:00:00Z",
      });
      const onConfirm = vi.fn();
      render(
        <CallDialingStep
          dict={dict}
          contactName="Luis"
          contactRole="Transportista"
          contactPhone={contactPhone}
          allowedMethods={["phone"]}
          reason=""
          line={line}
          dial={dial}
          token={token}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
      return { dial, token, hangup, onConfirm, opts: () => options };
    }

    it("dials from the browser and records how the call ended", async () => {
      const { dial, token, onConfirm, opts } = renderTelnyx();
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      await waitFor(() => expect(dial).toHaveBeenCalled());
      expect(token).toHaveBeenCalledTimes(1);
      expect(opts()?.destination).toBe("+56911111111");
      expect(opts()?.callerNumber).toBe("+56900000000");
      act(() => opts()?.onEnd(result));
      expect(onConfirm).toHaveBeenCalledWith(42, "phone", result);
    });

    it.each(["133", "131", "132", "134"])(
      "times a native emergency call to %s with a Telnyx line",
      (number) => {
        const { dial, token, onConfirm } = renderTelnyx(number);
        fireEvent.click(
          screen.getByRole("button", { name: "Llamada telefónica" })
        );
        expect(token).not.toHaveBeenCalled();
        expect(dial).not.toHaveBeenCalled();
        fireEvent.click(
          screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
        );
        expect(onConfirm).toHaveBeenCalledWith(expect.any(Number), "phone");
      }
    );

    it("the red button hangs up instead of timing by hand", async () => {
      const { dial, hangup, onConfirm } = renderTelnyx();
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      await waitFor(() => expect(dial).toHaveBeenCalled());
      fireEvent.click(
        screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
      );
      expect(hangup).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalledWith(42, "phone", result);
    });

    it("says so when the login fails", async () => {
      const onConfirm = vi.fn();
      render(
        <CallDialingStep
          dict={dict}
          contactName="Luis"
          contactRole="Transportista"
          contactPhone="+56 9 1111 1111"
          allowedMethods={["phone"]}
          reason=""
          line={line}
          dial={vi.fn()}
          token={vi.fn().mockRejectedValue(new Error("HTTP 409"))}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 409");
      expect(onConfirm).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: es.symptoms.call_modal_confirm })
      ).toBeNull();
    });
  });

  it("with a Teams Phone line, calls the number from Teams and saves it as pending", () => {
    const openTeams = vi.fn();
    const onConfirm = vi.fn();
    render(
      <CallDialingStep
        dict={dict}
        contactName="Luis"
        contactRole="Transportista"
        contactPhone="+56 9 1111 1111"
        channels={{ phone: "+56 9 2222 2222" }}
        allowedMethods={["phone", "teams"]}
        reason=""
        line={{
          connectionId: "m1",
          provider: "TEAMS_PHONE",
          name: "Teams",
          callerNumber: null,
          ready: true,
        }}
        openTeams={openTeams}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Llamada por Microsoft Teams" })
    );
    expect(openTeams).toHaveBeenCalledWith({
      app: "msteams:/l/call/0/0?users=4:+56922222222",
      web: "https://teams.microsoft.com/l/call/0/0?users=4:+56922222222",
    });
    fireEvent.click(
      screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
    );
    expect(onConfirm).toHaveBeenCalledWith(
      expect.any(Number),
      "teams",
      expect.objectContaining({
        provider: "TEAMS_PHONE",
        status: "PENDING",
        calleeNumber: "+56922222222",
        connectionId: "m1",
      })
    );
  });

  describe("on the managed line", () => {
    const line = {
      connectionId: "p1",
      provider: "TELNYX" as const,
      name: "Plataforma",
      callerNumber: "+56200000000",
      ready: true,
      managed: true,
    };

    it("sends the call's ref as client state and reports the end", async () => {
      let options: StartCallOptions | null = null;
      const dial = vi.fn(async (o: StartCallOptions) => {
        options = o;
        return { hangup: vi.fn() };
      });
      const token = vi.fn().mockResolvedValue({
        token: "jwt",
        callerNumber: "+56200000000",
        expiresAt: "2026-11-05T10:00:00Z",
        callRef: "ref-1",
      });
      const endCall = vi.fn().mockResolvedValue(undefined);
      render(
        <CallDialingStep
          dict={dict}
          contactName="Luis"
          contactRole="Transportista"
          contactPhone="+56 9 1111 1111"
          allowedMethods={["phone"]}
          reason=""
          line={line}
          caseRef="42"
          dial={dial}
          token={token}
          endCall={endCall}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      await waitFor(() => expect(dial).toHaveBeenCalled());
      expect(token).toHaveBeenCalledWith({
        calleeNumber: "+56911111111",
        caseRef: "42",
      });
      const opts = options as StartCallOptions | null;
      expect(opts?.clientState).toBe(btoa("ref-1"));
      act(() =>
        opts?.onEnd({
          provider: "TELNYX",
          answered: true,
          durationSeconds: 5,
          hangupCause: null,
          sipCode: null,
          callId: "v3:control-1",
          calleeNumber: "+56911111111",
          startedAt: "2026-11-04T10:00:00.000Z",
        })
      );
      expect(endCall).toHaveBeenCalledWith("ref-1", "v3:control-1");
    });

    it.each(["cancel-token", "sdk-failure"])(
      "releases a reservation after %s",
      async (failure) => {
        let resolveToken!: (value: {
          token: string;
          callerNumber: string;
          expiresAt: string;
          callRef: string;
        }) => void;
        const token = vi.fn(
          () =>
            new Promise<{
              token: string;
              callerNumber: string;
              expiresAt: string;
              callRef: string;
            }>((resolve) => {
              resolveToken = resolve;
            })
        );
        const endCall = vi.fn().mockResolvedValue(undefined);
        const dial = vi.fn().mockRejectedValue(new Error("SDK unavailable"));
        const { unmount } = render(
          <CallDialingStep
            dict={dict}
            contactName="Luis"
            contactRole="Transportista"
            contactPhone="+56911111111"
            allowedMethods={["phone"]}
            reason=""
            line={line}
            dial={dial}
            token={token}
            endCall={endCall}
            onCancel={vi.fn()}
            onConfirm={vi.fn()}
          />
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Llamada telefónica" })
        );
        if (failure === "cancel-token") unmount();
        await act(async () =>
          resolveToken({
            token: "jwt",
            callerNumber: "+56200000000",
            expiresAt: "2026-11-05T10:00:00Z",
            callRef: "late-ref",
          })
        );
        await waitFor(() =>
          expect(endCall).toHaveBeenCalledWith("late-ref", null)
        );
        if (failure === "sdk-failure") unmount();
        expect(endCall).toHaveBeenCalledTimes(1);
        expect(dial).toHaveBeenCalledTimes(failure === "sdk-failure" ? 1 : 0);
      }
    );

    it("says the minutes are used and offers the phone", async () => {
      const onConfirm = vi.fn();
      const token = vi
        .fn()
        .mockRejectedValue(
          new ControlTowerError("used", 409, "telephony_quota_exhausted")
        );
      render(
        <CallDialingStep
          dict={dict}
          contactName="Luis"
          contactRole="Transportista"
          contactPhone="+56 9 1111 1111"
          allowedMethods={["phone"]}
          reason=""
          line={line}
          dial={vi.fn()}
          token={token}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Llamada telefónica" })
      );
      expect(
        await screen.findByText(es.symptoms.call_quota_exhausted)
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: es.symptoms.call_use_phone })
      ).toHaveAttribute("href", "tel:+56911111111");
      fireEvent.click(
        screen.getByRole("link", { name: es.symptoms.call_use_phone })
      );
      expect(screen.queryByRole("alert")).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: es.symptoms.call_modal_confirm })
      );
      expect(onConfirm).toHaveBeenCalledWith(expect.any(Number), "phone");
      expect(token).toHaveBeenCalledTimes(1);
    });
  });
});

describe("script blanks", () => {
  it("shows the fields the case lacks in amber in the message and the goal", () => {
    render(
      <CallDialingStep
        dict={dict}
        contactName="Luis"
        contactRole="Driver"
        allowedMethods={["phone"]}
        reason="Hola [nombre del conductor]"
        reasonParts={[{ text: "Hola " }, { blank: "[nombre del conductor]" }]}
        goal="Confirmar [patente]"
        goalParts={[{ text: "Confirmar " }, { blank: "[patente]" }]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("[nombre del conductor]").className).toContain(
      "text-amber-700"
    );
    expect(screen.getByText("[patente]").className).toContain("text-amber-700");
  });
});
