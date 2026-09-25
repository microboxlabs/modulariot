package com.microboxlabs.miot.core.selectable;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Text in several languages, as a map from language code ({@code es}, {@code en}) to text. */
public final class Localized {

    public static final String DEFAULT_LANGUAGE = "es";
    private static final Pattern LANGUAGE = Pattern.compile("^[a-z]{2}$");

    private Localized() {
    }

    public static Map<String, String> of(String es, String en) {
        Map<String, String> out = new LinkedHashMap<>();
        out.put("es", es);
        out.put("en", en);
        return out;
    }

    /** Trims every text and drops the blank ones; a bad language code is an {@link IllegalArgumentException}. */
    public static Map<String, String> clean(Map<String, String> texts, String field) {
        Map<String, String> out = new LinkedHashMap<>();
        if (texts == null) {
            return out;
        }
        texts.forEach((language, text) -> {
            if (language == null || !LANGUAGE.matcher(language).matches()) {
                throw new IllegalArgumentException(field + ": language must be a two-letter code: " + language);
            }
            if (text != null && !text.isBlank()) {
                out.put(language, text.trim());
            }
        });
        return out;
    }

    /** Like {@link #clean} but at least one language must have text. */
    public static Map<String, String> required(Map<String, String> texts, String field) {
        Map<String, String> out = clean(texts, field);
        if (out.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return out;
    }

    /** The text in the default language, else the first one there is. */
    public static String preferred(Map<String, String> texts) {
        if (texts == null || texts.isEmpty()) {
            return "";
        }
        String text = texts.get(DEFAULT_LANGUAGE);
        return text != null ? text : texts.values().iterator().next();
    }
}
