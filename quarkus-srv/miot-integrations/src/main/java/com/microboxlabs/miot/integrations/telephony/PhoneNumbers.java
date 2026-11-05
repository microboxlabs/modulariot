package com.microboxlabs.miot.integrations.telephony;

import java.util.regex.Pattern;

/** Supported E.164 format: a plus sign and 7 to 15 digits in all. */
public final class PhoneNumbers {

    private static final Pattern E164 = Pattern.compile("\\+[1-9]\\d{6,14}");
    private static final Pattern SEPARATORS = Pattern.compile("[\\s().-]");

    private PhoneNumbers() {
    }

    /** The number without spaces, dots, dashes or parentheses, or null when it is not E.164. */
    public static String e164(Object value) {
        if (value == null) {
            return null;
        }
        String compact = SEPARATORS.matcher(value.toString().trim()).replaceAll("");
        return E164.matcher(compact).matches() ? compact : null;
    }
}
