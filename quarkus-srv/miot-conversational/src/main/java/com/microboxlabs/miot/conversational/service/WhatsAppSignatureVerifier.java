package com.microboxlabs.miot.conversational.service;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Verifies the {@code X-Hub-Signature-256} header Meta attaches to every webhook POST:
 * {@code sha256=<hex>} where {@code <hex>} is {@code HMAC-SHA256(app_secret, rawBody)} over the
 * exact bytes received. This is the only thing standing between the public webhook path and an
 * attacker, so verification is fail-closed: a null/blank secret, a missing or malformed header,
 * or any mismatch returns {@code false} (the resource then answers 401 without touching the body).
 *
 * <p>Static + pure so it is unit-testable without HTTP or CDI, mirroring the module's other
 * extracted decision helpers.
 */
public final class WhatsAppSignatureVerifier {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String SHA256_PREFIX = "sha256=";

    private WhatsAppSignatureVerifier() {
    }

    public static boolean verify(byte[] payload, String signatureHeader, String appSecret) {
        if (payload == null || signatureHeader == null || appSecret == null || appSecret.isBlank()) {
            return false;
        }
        if (!signatureHeader.startsWith(SHA256_PREFIX)) {
            return false;
        }
        String presented = signatureHeader.substring(SHA256_PREFIX.length());
        if (presented.isBlank()) {
            return false;
        }
        String expected = hmacSha256Hex(payload, appSecret);
        // Constant-time compare so a near-miss signature can't be brute-forced byte by byte.
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                presented.getBytes(StandardCharsets.UTF_8));
    }

    static String hmacSha256Hex(byte[] payload, String secret) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal(payload));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable in this JVM", e);
        }
    }
}
