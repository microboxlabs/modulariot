package com.microboxlabs.miot.fleet.directory;

import java.text.Normalizer;
import java.util.Locale;

/** What an asset is. GPS providers report free text; {@link #fromReported} maps the common values. */
public enum AssetKind {
    TRUCK, TRAILER, DECOY, PERSON, OTHER;

    public static AssetKind fromReported(String reported) {
        if (reported == null || reported.isBlank()) {
            return OTHER;
        }
        String t = Normalizer.normalize(reported, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).trim();
        if (t.contains("jaula") || t.contains("rampla") || t.contains("trailer") || t.contains("remolque")
                || t.contains("cama baja") || t.contains("batea")) {
            return TRAILER;
        }
        if (t.contains("senuelo") || t.contains("decoy") || t.contains("baliza")) {
            return DECOY;
        }
        if (t.contains("conductor") || t.contains("driver") || t.contains("persona") || t.contains("chofer")) {
            return PERSON;
        }
        if (t.contains("truck") || t.contains("camion") || t.contains("tracto") || t.contains("vehic")
                || t.contains("car") || t.contains("scania") || t.contains("volvo") || t.contains("mercedes")
                || t.contains("freightliner") || t.contains("kenworth") || t.contains("international")) {
            return TRUCK;
        }
        return OTHER;
    }

    /** The kind a profile stores, or null when the text is not a kind. */
    public static AssetKind parse(String value) {
        if (value == null) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
