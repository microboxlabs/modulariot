import type { IgnoredInfo } from "./ignore-hold";

/** What the operators did about a case, as the modulith names it. */
export type TreatmentState = "untreated" | "in_treatment" | "treated";

/** How a closed treatment handled the case. */
export type TreatmentOutcome = "call" | "handling" | "ignore" | "invalidate";

/** The filter's URL parameter, and its parameter in the symptom APIs. */
export const TREATMENT_PARAM = "treatment";

export const TREATMENT_STATES: TreatmentState[] = [
  "untreated",
  "in_treatment",
  "treated",
];

/** The treatment a case's state is about, as the modulith answers it. */
export interface CaseTreatment {
  id: string;
  status: "OPEN" | "CLOSED";
  type?: string | null;
  outcome?: TreatmentOutcome | null;
  outcome_label?: string | null;
  resolution?: string | null;
  opened_by?: string | null;
  opened_at?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  /** Whether the user has an open treatment on the case. */
  mine?: boolean;
  /** Who has an open treatment on the case now. */
  operators?: string[];
}

/** The state a raw value names, or undefined when it names none. */
export function parseTreatmentState(
  raw: string | null | undefined
): TreatmentState | undefined {
  const value = raw?.trim();
  return TREATMENT_STATES.find((state) => state === value);
}

/** What the row's button does. */
export type CaseAction = "treat" | "continue" | "view_treatment" | "view_case";

/**
 * The action a case offers the user: continue the user's own open treatment,
 * treat any other open case (again, or alongside another operator), or only
 * look at a closed one.
 */
export function caseActionOf(
  state: TreatmentState | null | undefined,
  treatment: CaseTreatment | null | undefined,
  closed: boolean
): CaseAction {
  if (state === "in_treatment" && treatment?.mine) return "continue";
  if (closed)
    return !state || state === "untreated" ? "view_case" : "view_treatment";
  return "treat";
}

/** Who handled the treatment: whoever closed it, else whoever opened it. */
export function treatmentOperator(
  treatment: CaseTreatment | null | undefined
): string | null {
  return treatment?.closed_by ?? treatment?.opened_by ?? null;
}

/** When the treatment reached its state: closed, else opened. */
export function treatmentAt(
  treatment: CaseTreatment | null | undefined
): string | null {
  return treatment?.closed_at ?? treatment?.opened_at ?? null;
}

/** The other operators with an open treatment, for a case the user does not treat. */
export function otherOperators(
  treatment: CaseTreatment | null | undefined
): string[] {
  if (!treatment || treatment.mine) return [];
  const operators = treatment.operators?.length
    ? treatment.operators
    : [treatment.opened_by];
  return operators.filter((name): name is string => !!name);
}

/**
 * Whether the treatment page only shows the case: it is closed or on hold.
 * A treated case, or one another operator treats, can be treated again.
 */
export function isReadOnlyCase(info: {
  ignored?: IgnoredInfo | null;
  closed_at?: string | null;
  treatment_state?: TreatmentState | null;
  treatment?: CaseTreatment | null;
}): boolean {
  return !!info.ignored || !!info.closed_at;
}
