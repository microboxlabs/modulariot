package com.microboxlabs.miot.symptoms.domain;

/** What the operator is doing about a symptom. Each value maps to one legacy {@code treatments.treatment_type}. */
public enum TreatmentType {
    CALL("llamar al conductor"),
    IGNORE_CONDITION("ignorar condicion"),
    INVALIDATE_SYMPTOM("invalidar sintoma");

    private final String legacyType;

    TreatmentType(String legacyType) {
        this.legacyType = legacyType;
    }

    /** The string the StreamHub engine and the existing tower views key on. */
    public String legacyType() {
        return legacyType;
    }

    public boolean accepts(ActionKind kind) {
        if (kind == ActionKind.NOTE) {
            return true;
        }
        return switch (this) {
            case CALL -> kind == ActionKind.CALL;
            case IGNORE_CONDITION -> kind == ActionKind.IGNORE;
            case INVALIDATE_SYMPTOM -> kind == ActionKind.INVALIDATE;
        };
    }
}
