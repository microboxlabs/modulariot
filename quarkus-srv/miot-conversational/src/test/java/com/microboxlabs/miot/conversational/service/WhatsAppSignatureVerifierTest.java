package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * Verifies the X-Hub-Signature-256 HMAC check. The expected signature is an independent vector
 * computed with {@code openssl dgst -sha256 -hmac topsecret} over {@code {"hello":"world"}}, so
 * the test pins the algorithm rather than re-deriving it through the code under test.
 */
class WhatsAppSignatureVerifierTest {

    private static final byte[] PAYLOAD = "{\"hello\":\"world\"}".getBytes(StandardCharsets.UTF_8);
    private static final String SECRET = "topsecret";
    private static final String EXPECTED_HEX =
            "afd00617ceb8f63e65ea5c310f06bf78c3901e7a713db532e25da26ad63c7236";
    private static final String VALID_HEADER = "sha256=" + EXPECTED_HEX;

    @Test
    void hmacMatchesIndependentOpensslVector() {
        assertEquals(EXPECTED_HEX, WhatsAppSignatureVerifier.hmacSha256Hex(PAYLOAD, SECRET));
    }

    @Test
    void verifyAcceptsAValidSignature() {
        assertTrue(WhatsAppSignatureVerifier.verify(PAYLOAD, VALID_HEADER, SECRET));
    }

    @Test
    void verifyRejectsAWrongSecret() {
        assertFalse(WhatsAppSignatureVerifier.verify(PAYLOAD, VALID_HEADER, "not-the-secret"));
    }

    @Test
    void verifyRejectsATamperedPayload() {
        byte[] tampered = "{\"hello\":\"WORLD\"}".getBytes(StandardCharsets.UTF_8);
        assertFalse(WhatsAppSignatureVerifier.verify(tampered, VALID_HEADER, SECRET));
    }

    @Test
    void verifyRejectsAHeaderWithoutTheSha256Prefix() {
        assertFalse(WhatsAppSignatureVerifier.verify(PAYLOAD, EXPECTED_HEX, SECRET));
    }

    @Test
    void verifyRejectsABlankHexAfterThePrefix() {
        assertFalse(WhatsAppSignatureVerifier.verify(PAYLOAD, "sha256=", SECRET));
    }

    @Test
    void verifyRejectsNullsAndBlankSecret() {
        assertFalse(WhatsAppSignatureVerifier.verify(null, VALID_HEADER, SECRET));
        assertFalse(WhatsAppSignatureVerifier.verify(PAYLOAD, null, SECRET));
        assertFalse(WhatsAppSignatureVerifier.verify(PAYLOAD, VALID_HEADER, null));
        assertFalse(WhatsAppSignatureVerifier.verify(PAYLOAD, VALID_HEADER, "   "));
    }
}
