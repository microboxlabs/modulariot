package com.microboxlabs.miot.integrations.api;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

/** The {@code month} query parameter: {@code YYYY-MM}, or null for the current month. */
final class Months {

    private Months() {
    }

    static YearMonth parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return YearMonth.parse(value.strip());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("month must be YYYY-MM");
        }
    }
}
