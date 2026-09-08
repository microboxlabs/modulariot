package com.microboxlabs.miot.core.branding;

import jakarta.ws.rs.BadRequestException;
import java.util.Locale;

/**
 * Normalizes a host into the form stored in {@code domain_branding.domain}.
 *
 * <p>Lookups are exact string matches, so the writer and the reader have to
 * agree on one spelling. Both go through here: the admin API normalizes what
 * an operator types, and the public API normalizes the host it was called
 * with, which arrives from a {@code Host} / {@code X-Forwarded-Host} header
 * and may carry a port or a trailing dot.
 */
public final class DomainName {

    /** Maximum length of a DNS name, matching the column width. */
    private static final int MAX_LENGTH = 253;
    private static final int MAX_LABEL_LENGTH = 63;

    private DomainName() {
    }

    /**
     * @throws BadRequestException when {@code raw} is not a plausible DNS host
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("domain is required");
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);

        // A Host header may carry the port; branding does not vary by port. Only
        // a numeric suffix is treated as one, so "https://host" is rejected below
        // rather than silently truncated to the single label "https".
        int colon = value.indexOf(':');
        if (colon >= 0) {
            if (!isPort(value.substring(colon + 1))) {
                throw new BadRequestException("Invalid domain: " + value);
            }
            value = value.substring(0, colon);
        }
        // "example.com." and "example.com" are the same name.
        if (value.endsWith(".")) {
            value = value.substring(0, value.length() - 1);
        }

        if (value.isEmpty() || value.length() > MAX_LENGTH) {
            throw new BadRequestException("domain must be 1-" + MAX_LENGTH + " characters");
        }
        for (String label : value.split("\\.", -1)) {
            validateLabel(label, value);
        }
        return value;
    }

    private static boolean isPort(String candidate) {
        if (candidate.isEmpty() || candidate.length() > 5) {
            return false;
        }
        for (int i = 0; i < candidate.length(); i++) {
            if (candidate.charAt(i) < '0' || candidate.charAt(i) > '9') {
                return false;
            }
        }
        return true;
    }

    private static void validateLabel(String label, String domain) {
        if (label.isEmpty() || label.length() > MAX_LABEL_LENGTH) {
            throw new BadRequestException("Invalid domain: " + domain);
        }
        if (label.startsWith("-") || label.endsWith("-")) {
            throw new BadRequestException("Invalid domain: " + domain);
        }
        for (int i = 0; i < label.length(); i++) {
            char c = label.charAt(i);
            boolean allowed = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-';
            if (!allowed) {
                throw new BadRequestException("Invalid domain: " + domain);
            }
        }
    }
}
