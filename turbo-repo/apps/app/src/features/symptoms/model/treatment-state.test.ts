import { describe, expect, it } from "vitest";
import {
  caseActionOf,
  isReadOnlyCase,
  otherOperators,
  parseTreatmentState,
  treatmentAt,
  treatmentOperator,
  type CaseTreatment,
} from "./treatment-state";

const open: CaseTreatment = {
  id: "t-1",
  status: "OPEN",
  opened_by: "operator-a",
  opened_at: "2026-01-01T00:05:00Z",
  mine: false,
  operators: ["operator-a", "operator-b"],
};
const closed: CaseTreatment = {
  id: "t-2",
  status: "CLOSED",
  outcome: "call",
  opened_by: "operator-a",
  opened_at: "2026-01-01T00:05:00Z",
  closed_by: "operator-b",
  closed_at: "2026-01-01T00:09:00Z",
};

describe("parseTreatmentState", () => {
  it.each(["untreated", "in_treatment", "treated"])("keeps %s", (state) => {
    expect(parseTreatmentState(` ${state} `)).toBe(state);
  });

  it.each([null, undefined, "", "done", "TREATED"])("drops %j", (raw) => {
    expect(parseTreatmentState(raw)).toBeUndefined();
  });
});

describe("caseActionOf", () => {
  it("treats only an open case nobody treats", () => {
    expect(caseActionOf("untreated", null, false)).toBe("treat");
    expect(caseActionOf("untreated", null, true)).toBe("view_case");
  });

  it("continues the user's own open treatment", () => {
    expect(caseActionOf("in_treatment", { ...open, mine: true }, false)).toBe(
      "continue"
    );
    expect(caseActionOf("untreated", { ...open, mine: true }, true)).toBe(
      "continue"
    );
    expect(caseActionOf("treated", { ...open, mine: true }, true)).toBe(
      "continue"
    );
  });

  it("offers a treatment alongside another operator on an open case", () => {
    expect(caseActionOf("in_treatment", open, false)).toBe("treat");
  });

  it("offers a new treatment on an open treated case and only shows a closed one", () => {
    expect(caseActionOf("treated", closed, false)).toBe("treat");
    expect(caseActionOf("treated", closed, true)).toBe("view_treatment");
    expect(caseActionOf("in_treatment", open, true)).toBe("view_treatment");
  });

  it("keeps Tratar for a symptom without a treatment state", () => {
    expect(caseActionOf(undefined, undefined, false)).toBe("treat");
  });
});

describe("who and when", () => {
  it("reads a closed treatment from its close", () => {
    expect(treatmentOperator(closed)).toBe("operator-b");
    expect(treatmentAt(closed)).toBe("2026-01-01T00:09:00Z");
  });

  it("reads an open treatment from its opening", () => {
    expect(treatmentOperator(open)).toBe("operator-a");
    expect(treatmentAt(open)).toBe("2026-01-01T00:05:00Z");
    expect(treatmentOperator(null)).toBeNull();
  });

  it("names the other operators only when the treatment is not the user's", () => {
    expect(otherOperators(open)).toEqual(["operator-a", "operator-b"]);
    expect(otherOperators({ ...open, operators: [] })).toEqual(["operator-a"]);
    expect(otherOperators({ ...open, mine: true })).toEqual([]);
    expect(otherOperators(null)).toEqual([]);
  });
});

describe("isReadOnlyCase", () => {
  it("leaves an open treated case editable, for a new treatment", () => {
    expect(
      isReadOnlyCase({ treatment_state: "treated", treatment: closed })
    ).toBe(false);
  });
  it("locks a closed case", () => {
    expect(
      isReadOnlyCase({
        closed_at: "2026-01-01T00:10:00Z",
        treatment_state: "treated",
      })
    ).toBe(true);
  });

  it("leaves an open case editable whoever treats it", () => {
    expect(
      isReadOnlyCase({ treatment_state: "in_treatment", treatment: open })
    ).toBe(false);
    expect(
      isReadOnlyCase({
        treatment_state: "in_treatment",
        treatment: { ...open, mine: true },
      })
    ).toBe(false);
  });

  it("leaves an open untreated case and a symptom without a state editable", () => {
    expect(isReadOnlyCase({ treatment_state: "untreated" })).toBe(false);
    expect(isReadOnlyCase({})).toBe(false);
  });
});
