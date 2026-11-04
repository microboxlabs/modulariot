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
import type { StartCallOptions, TelephonyCallResult } from "./telnyx-call";

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));

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

    function renderTelnyx() {
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
          contactPhone="+56 9 1111 1111"
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
});
