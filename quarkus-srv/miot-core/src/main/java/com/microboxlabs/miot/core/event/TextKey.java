package com.microboxlabs.miot.core.event;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The form two texts are compared in when case, accents and spacing must not matter: lower case, without accents,
 * with runs of spaces as one space and no spaces at the ends. "  Planta  Norte " and "planta norte" have the same
 * key, and so do "Peñón" and "penon".
 */
public final class TextKey {

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SPACES = Pattern.compile("\\s+");

    private TextKey() {
    }

    /** The key of {@code text}; null and blank give an empty key. */
    public static String of(String text) {
        if (text == null) {
            return "";
        }
        String bare = MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFD)).replaceAll("");
        return SPACES.matcher(bare.toLowerCase(Locale.ROOT)).replaceAll(" ").trim();
    }
}
