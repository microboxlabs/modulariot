package com.microboxlabs.miot.core.tax;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * One form for a national id or company tax id (RUT, RUC, DNI) wherever two of them are compared: without dots,
 * dashes or spaces, upper case. {@code "12.345.678-k"} and {@code "12345678K"} are the same id. It does not check
 * the verifier; {@link ChileanRutValidator} does.
 */
public final class NationalIds {

    private static final Pattern SEPARATORS = Pattern.compile("[.\\-\\s]");

    private NationalIds() {
    }

    /** The id without separators, upper case; null when it is null, blank or only separators. */
    public static String normalize(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        String normalized = SEPARATORS.matcher(id).replaceAll("").toUpperCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }
}
