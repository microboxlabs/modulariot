package com.microboxlabs.miot.conversational.domain;

import java.util.Locale;

/** What a conversation is about. Stored lowercase ({@code service}, {@code symptom_case}, ...). */
public enum ContextKind {
    SERVICE,
    SYMPTOM_CASE,
    DOCUMENT,
    JOB,
    TRIP;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static ContextKind fromDb(String value) {
        return value == null ? null : valueOf(value.toUpperCase(Locale.ROOT));
    }
}
