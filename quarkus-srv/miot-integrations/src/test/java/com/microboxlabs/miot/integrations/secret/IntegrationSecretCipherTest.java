package com.microboxlabs.miot.integrations.secret;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.SecureRandom;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationSecretCipherTest {

    @Test
    void encryptsAndDecryptsSecretConfig() {
        IntegrationSecretCipher cipher = new IntegrationSecretCipher(
                new ObjectMapper(),
                new SecureRandom(),
                "test-encryption-key");

        String encrypted = cipher.encrypt(Map.of("token", "secret-token"));

        assertTrue(encrypted.startsWith("v1:"));
        assertFalse(encrypted.contains("secret-token"));
        assertEquals(Map.of("token", "secret-token"), cipher.decrypt(encrypted));
    }

    @Test
    void rejectsNonEmptySecretsWhenKeyIsNotConfigured() {
        IntegrationSecretCipher cipher = new IntegrationSecretCipher(
                new ObjectMapper(),
                new SecureRandom(),
                "not-configured");

        IntegrationSecretEncryptionException exception = assertThrows(
                IntegrationSecretEncryptionException.class,
                () -> cipher.encrypt(Map.of("token", "secret-token")));

        assertEquals("Integration secret encryption key is not configured", exception.getMessage());
    }
}
