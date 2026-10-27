import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import { tr } from "@/features/i18n/tr.service";
import type { EventTypeInfo, RuleTrigger } from "./conversations-types";
import RuleTriggerSection, { eventFormFields } from "./rule-trigger";

const d = es.pages.userSettings.communications;

describe("rule trigger form", () => {
  it("offers only scalar event fields as form conditions", () => {
    const info: EventTypeInfo = {
      type: "trip.updated",
      source: "trips",
      description: "Updated trip",
      fields: [
        { name: "label", label: "Label", type: "string" },
        { name: "changedFields", label: "Changed fields", type: "array" },
        { name: "eventData", label: "Event data", type: "object" },
      ],
    };
    expect(eventFormFields(info).map((field) => field.path)).toEqual([
      "event.data.label",
    ]);
  });

  it("keeps any selected for an unconditional rule", () => {
    const trigger: RuleTrigger = { event: "trip.updated", when: null };
    const onChange = vi.fn();
    const props = {
      trigger,
      info: undefined,
      catalog: undefined,
      sample: {
        type: "trip.updated",
        context: { kind: "trip", key: "test" },
        data: {},
        test: false,
        at: "2026-01-01T00:00:00Z",
      },
      fields: [],
      problems: [],
      summary: "Always",
      changed: false,
      readOnly: false,
      d,
      formDict: es.pages.userSettings.symptomCatalog,
      onChange,
    };
    const { rerender } = render(<RuleTriggerSection {...props} />);
    const match = screen.getByLabelText(
      tr("listMatch", props.formDict)
    ) as HTMLSelectElement;
    fireEvent.change(match, { target: { value: "any" } });
    rerender(<RuleTriggerSection {...props} />);
    expect(match.value).toBe("any");
    expect(onChange).not.toHaveBeenCalled();
  });
});
