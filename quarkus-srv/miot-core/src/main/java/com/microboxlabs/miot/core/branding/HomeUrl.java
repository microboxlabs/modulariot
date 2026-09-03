package com.microboxlabs.miot.core.branding;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * Validates the link the branded logo points at.
 *
 * <p>The value is rendered straight into an anchor's {@code href}, so the
 * scheme has to be restricted here: a stored {@code javascript:} URL would
 * execute for every visitor of the sign-in page, which is unauthenticated.
 */
public final class HomeUrl {

    private static final int MAX_LENGTH = 2048;

    private HomeUrl() {
    }

    /** @return the normalized URL, or {@code null} when {@code raw} is absent */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (value.length() > MAX_LENGTH) {
            throw new BadRequestException("homeUrl exceeds " + MAX_LENGTH + " characters");
        }
        URI uri;
        try {
            uri = new URI(value);
        } catch (URISyntaxException e) {
            throw new BadRequestException("homeUrl is not a valid URL");
        }
        String scheme = uri.getScheme() == null
                ? null
                : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new BadRequestException("homeUrl must be an http(s) URL");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new BadRequestException("homeUrl must include a host");
        }
        return value;
    }
}
