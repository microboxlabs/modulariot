package com.microboxlabs.miot.integrations.telephony;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Checks a Telnyx webhook: {@code telnyx-signature-ed25519} is the ed25519 signature of
 * {@code telnyx-timestamp + "|" + body}, made with the account's key; the public key is in the TELNYX
 * connection's {@code metadata.webhookPublicKey} (base64, as the Telnyx portal shows it). A timestamp more than
 * {@link #TOLERANCE} away from now is refused, so an old delivery cannot be replayed.
 */
public final class TelnyxWebhookVerifier {

    static final Duration TOLERANCE = Duration.ofMinutes(5);
    /** DER prefix of an X.509 ed25519 public key; the raw 32 bytes follow. */
    private static final byte[] ED25519_PREFIX = HexFormat.of().parseHex("302a300506032b6570032100");

    private TelnyxWebhookVerifier() {
    }

    public static boolean verify(String publicKeyBase64, String signatureBase64, String timestamp, String body,
            Instant now) {
        if (publicKeyBase64 == null || signatureBase64 == null || timestamp == null || body == null) {
            return false;
        }
        try {
            Instant sent = Instant.ofEpochSecond(Long.parseLong(timestamp.trim()));
            if (Duration.between(sent, now).abs().compareTo(TOLERANCE) > 0) {
                return false;
            }
            Signature verifier = Signature.getInstance("Ed25519");
            verifier.initVerify(publicKey(publicKeyBase64.trim()));
            verifier.update((timestamp.trim() + "|" + body).getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.getDecoder().decode(signatureBase64.trim()));
        } catch (NumberFormatException | GeneralSecurityException e) {
            return false;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    static PublicKey publicKey(String base64) throws GeneralSecurityException {
        byte[] raw = Base64.getDecoder().decode(base64);
        byte[] der = raw.length == 32 ? concat(ED25519_PREFIX, raw) : raw;
        return KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(der));
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }
}
