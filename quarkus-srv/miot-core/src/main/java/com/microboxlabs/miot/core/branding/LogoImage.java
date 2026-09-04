package com.microboxlabs.miot.core.branding;

import jakarta.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;
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

    /** Length of MAX_BYTES once base64-encoded: four characters per three bytes. */
    private static final int MAX_ENCODED_LENGTH = ((MAX_BYTES + 2) / 3) * 4;

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

        String encoded = value.substring(marker + BASE64_MARKER.length());
        // Reject on the encoded length first, so an oversized upload does not
        // get decoded into a large array only to be thrown away.
        if (encoded.length() > MAX_ENCODED_LENGTH) {
            throw new BadRequestException("Logo exceeds " + MAX_BYTES + " bytes");
        }

        byte[] content;
        try {
            content = Base64.getDecoder().decode(encoded);
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
        return new LogoImage(mime, content, etagOf(mime, content));
    }

    /**
     * The tag identifies the whole response, Content-Type included, so the mime
     * is hashed with the bytes: the same bytes served under a different type are
     * a different representation and must not reuse a cached validator.
     */
    // A record compares and prints an array field by reference, so the generated
    // members would report two identical logos as different and dump the raw
    // bytes into any log line that formatted one.

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof LogoImage that)) {
            return false;
        }
        return Objects.equals(mime, that.mime)
                && Objects.equals(etag, that.etag)
                && Arrays.equals(content, that.content);
    }

    @Override
    public int hashCode() {
        return 31 * Objects.hash(mime, etag) + Arrays.hashCode(content);
    }

    @Override
    public String toString() {
        return "LogoImage[mime=" + mime + ", bytes=" + content.length + ", etag=" + etag + "]";
    }

    private static String etagOf(String mime, byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(mime.getBytes(StandardCharsets.UTF_8));
            digest.update((byte) '\n');
            digest.update(content);
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the Java platform", e);
        }
    }
}
