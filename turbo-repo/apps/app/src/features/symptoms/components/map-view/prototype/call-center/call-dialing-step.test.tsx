import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import CallDialingStep from "./call-dialing-step";

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
});
