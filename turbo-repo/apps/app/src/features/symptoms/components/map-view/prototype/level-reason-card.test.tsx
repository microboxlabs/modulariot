import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import es from "@/lang/es.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import LevelReasonCard from "./level-reason-card";

const dict = es as unknown as I18nRecord;

describe("LevelReasonCard", () => {
  it("says why a lost-signal case is under observation", () => {
    render(
      <LevelReasonCard
        dict={dict}
        reason={{
          icu_code: 1,
          rule: "check.loss.low_coverage_zone",
          context: {
            check: { loss: { silence_s: 1200, low_coverage_zone: true } },
          },
        }}
      />
    );
    expect(screen.getByText("Por qué este nivel")).toBeTruthy();
    expect(screen.getByText("En observación")).toBeTruthy();
    expect(screen.getByText("20 min")).toBeTruthy();
    expect(screen.getByText("check.loss.low_coverage_zone")).toBeTruthy();
    expect(screen.getByText("Zona de baja cobertura")).toBeTruthy();
  });

  it("says when the case kept no context, and hides without a reason", () => {
    const { container, rerender } = render(
      <LevelReasonCard dict={dict} reason={{ icu_code: 4, context: null }} />
    );
    expect(
      screen.getByText("Este caso no guardó lo que evaluó la regla.")
    ).toBeTruthy();
    rerender(<LevelReasonCard dict={dict} reason={null} />);
    expect(container.innerHTML).toBe("");
  });
});
