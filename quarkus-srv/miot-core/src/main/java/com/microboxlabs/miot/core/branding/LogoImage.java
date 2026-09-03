package com.microboxlabs.miot.core.branding;

import jakarta.ws.rs.BadRequestException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

/**
 * A decoded, validated logo.
 *
 * <p>Logos are uploaded as {@code data:} URLs inside the JSON body rather than
 * as multipart: the payload is capped at a few hundred kilobytes, and no other
 * endpoint in the modulith takes multipart, so this avoids pulling that
 * extension in for one field.
 */
public record LogoImage(String mime, byte[] content, String etag) {

    public static final int MAX_BYTES = 256 * 1024;

    /** Kept in step with {@code chk_domain_branding_mime} in V0.1.5. */
    private static final Set<String> ALLOWED_MIMES = Set.of(
            "image/svg+xml", "image/png", "image/jpeg", "image/webp");

    private static final String PREFIX = "data:";
    private static final String BASE64_MARKER = ";base64,";

    public static LogoImage fromDataUrl(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            throw new BadRequestException("logoDataUrl is required");
        }
        String value = dataUrl.trim();
        if (!value.startsWith(PREFIX)) {
            throw new BadRequestException("logoDataUrl must be a data: URL");
        }
        int marker = value.indexOf(BASE64_MARKER);
        if (marker < 0) {
            throw new BadRequestException("logoDataUrl must be base64-encoded");
        }

        String mime = value.substring(PREFIX.length(), marker).trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_MIMES.contains(mime)) {
            throw new BadRequestException("Unsupported logo type: " + mime);
        }

        byte[] content;
        try {
            content = Base64.getDecoder().decode(
                    value.substring(marker + BASE64_MARKER.length()));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("logoDataUrl is not valid base64");
        }
        if (content.length == 0) {
            throw new BadRequestException("logoDataUrl is empty");
        }
        if (content.length > MAX_BYTES) {
            throw new BadRequestException(
                    "Logo exceeds " + MAX_BYTES + " bytes: " + content.length);
        }
        return new LogoImage(mime, content, sha256Hex(content));
    }

    private static String sha256Hex(byte[] content) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the Java platform", e);
        }
    }
}
