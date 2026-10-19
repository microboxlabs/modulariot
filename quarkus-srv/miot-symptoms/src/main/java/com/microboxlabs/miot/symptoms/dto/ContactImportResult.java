package com.microboxlabs.miot.symptoms.dto;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.List;
import java.util.Locale;

/** What a bulk import did, in total and for each row in the order sent. */
public record ContactImportResult(int created, int skipped, int errors, List<Row> rows) {

    public enum Status {
        CREATED, SKIPPED, ERROR;

        @JsonValue
        public String json() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /** {@code index} is the row's position in the request, from 0. {@code contact} is set when created. */
    public record Row(int index, Status status, String reason, ContactView contact) {
    }
}
