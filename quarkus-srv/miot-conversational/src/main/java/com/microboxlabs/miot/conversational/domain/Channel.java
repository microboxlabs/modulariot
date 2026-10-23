package com.microboxlabs.miot.conversational.domain;

import java.util.Locale;

/** The channel a message went out or came in on. Stored lowercase ({@code whatsapp}, {@code email}). */
public enum Channel {
    WHATSAPP,
    EMAIL;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static Channel fromDb(String value) {
        return value == null ? WHATSAPP : valueOf(value.toUpperCase(Locale.ROOT));
    }
}
