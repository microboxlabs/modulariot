import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import RuleDraftBar, { PublishRuleDialog } from "./rule-draft-bar";

const d = es.pages.userSettings.communications;
const CHANGES = [{ key: "step0", text: "Paso 1 cambiado" }];

describe("RuleDraftBar", () => {
  it("opens a panel with the version the draft makes and its bump", () => {
    render(
      <RuleDraftBar
        changes={CHANGES}
        errors={0}
        saving={false}
        saveError={null}
        current="0.2.0"
        bump="PATCH"
        d={d}
        onReview={vi.fn()}
      />
    );
    expect(screen.queryByText("0.2.1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /1 cambio/ }));
    expect(screen.getByText("0.2.1")).toBeTruthy();
    expect(screen.getByText("PARCHE")).toBeTruthy();
  });
});

describe("PublishRuleDialog", () => {
  it("goes from the version in force to the next one and lets the bump be raised", async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(
      <PublishRuleDialog
        open
        changes={CHANGES}
        current="0.2.0"
        bump="PATCH"
        canPublish
        d={d}
        onClose={vi.fn()}
        onPublish={onPublish}
      />
    );
    expect(screen.getByText("0.2.0")).toBeTruthy();
    expect(screen.getByText("0.2.1")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "MAJOR" },
    });
    expect(screen.getByText("1.0.0")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Otro flujo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith("Otro flujo", "MAJOR")
    );
  });

  it("offers no raise on the first publish, which is 0.1.0", () => {
    render(
      <PublishRuleDialog
        open
        changes={CHANGES}
        current={null}
        bump="MINOR"
        canPublish
        d={d}
        onClose={vi.fn()}
        onPublish={vi.fn()}
      />
    );
    expect(screen.getByText("0.1.0")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
