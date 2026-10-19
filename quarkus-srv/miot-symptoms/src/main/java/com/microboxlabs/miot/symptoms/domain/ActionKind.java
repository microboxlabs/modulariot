package com.microboxlabs.miot.symptoms.domain;

/** One step inside a treatment: a call attempt, the ignore/invalidate decision, or a free note. */
public enum ActionKind {
    CALL,
    IGNORE,
    INVALIDATE,
    NOTE
}
