package com.microboxlabs.miot.core.branding;

import java.util.ArrayList;
import java.util.List;

/**
 * Evaluates an {@code If-None-Match} header against one entity tag.
 *
 * <p>RFC 9110 allows a comma-separated list, {@code *}, and weak validators,
 * and requires the weak comparison function for {@code GET}. A browser echoes
 * back exactly what was sent, but an intermediary — a CDN or a reverse proxy —
 * may rewrite a strong tag into its weak form, and a plain string equality
 * check would then miss the match and resend the whole image.
 */
public final class EntityTagMatch {


    private static final String WEAK_PREFIX = "W/";

    private EntityTagMatch() {
    }

    /**
     * @param ifNoneMatch the raw header, or {@code null} when absent
     * @param etag        the current tag's opaque value, unquoted
     */
    public static boolean matches(String ifNoneMatch, String etag) {
        if (ifNoneMatch == null || etag == null) {
            return false;
        }
        String header = ifNoneMatch.trim();
        if (header.isEmpty()) {
            return false;
        }
        if ("*".equals(header)) {
            return true;
        }
        for (String candidate : splitEntries(header)) {
            if (etag.equals(opaqueValue(candidate))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Splits the list on commas that separate entries rather than on commas
     * inside a tag. RFC 9110's {@code etagc} admits "," in the opaque value, and
     * excludes the double quote, so quoting cannot itself be escaped and a plain
     * toggle tracks it exactly.
     */
    private static List<String> splitEntries(String header) {
        List<String> entries = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < header.length(); i++) {
            char c = header.charAt(i);
            if (c == '"') {
                quoted = !quoted;
                current.append(c);
            } else if (c == ',' && !quoted) {
                entries.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        entries.add(current.toString());
        return entries;
    }

    /** Strips the weak marker and the surrounding quotes from one list entry. */
    private static String opaqueValue(String candidate) {
        String value = candidate.trim();
        if (value.startsWith(WEAK_PREFIX)) {
            value = value.substring(WEAK_PREFIX.length()).trim();
        }
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            return value.substring(1, value.length() - 1);
        }
        return null;
    }
}
