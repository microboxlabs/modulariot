package com.microboxlabs.miot.integrations.secret;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class IntegrationSecretCipher {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;
    private static final String NOT_CONFIGURED = "not-configured";
    private static final TypeReference<Map<String, Object>> SECRET_CONFIG_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom;
    private final String encryptionKey;

    @Inject
    public IntegrationSecretCipher(
            ObjectMapper objectMapper,
            @ConfigProperty(name = "miot.integrations.secret-key", defaultValue = NOT_CONFIGURED)
            String encryptionKey) {
        this(objectMapper, new SecureRandom(), encryptionKey);
    }

    IntegrationSecretCipher(ObjectMapper objectMapper, SecureRandom secureRandom, String encryptionKey) {
        this.objectMapper = objectMapper;
        this.secureRandom = secureRandom;
        this.encryptionKey = encryptionKey;
    }

    public String encrypt(Map<String, Object> secretConfig) {
        if (secretConfig == null || secretConfig.isEmpty()) {
            return null;
        }
        if (encryptionKey == null || encryptionKey.isBlank() || NOT_CONFIGURED.equals(encryptionKey)) {
            throw new IntegrationSecretEncryptionException(
                    "Integration secret encryption key is not configured",
                    null);
        }

        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(deriveAesKey(), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(objectMapper.writeValueAsBytes(secretConfig));

            return "v1:" + Base64.getEncoder().encodeToString(iv)
                    + ":" + Base64.getEncoder().encodeToString(ciphertext);
        } catch (GeneralSecurityException | JsonProcessingException e) {
            throw new IntegrationSecretEncryptionException("Unable to encrypt integration secret config", e);
        }
    }

    public Map<String, Object> decrypt(String encryptedSecretJson) {
        if (encryptedSecretJson == null || encryptedSecretJson.isBlank()) {
            return Map.of();
        }
        if (encryptionKey == null || encryptionKey.isBlank() || NOT_CONFIGURED.equals(encryptionKey)) {
            throw new IntegrationSecretEncryptionException(
                    "Integration secret encryption key is not configured",
                    null);
        }

        try {
            String[] parts = encryptedSecretJson.split(":", 3);
            if (parts.length != 3 || !"v1".equals(parts[0])) {
                throw new IntegrationSecretEncryptionException("Unsupported integration secret ciphertext format", null);
            }

            byte[] iv = Base64.getDecoder().decode(parts[1]);
            byte[] ciphertext = Base64.getDecoder().decode(parts[2]);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(deriveAesKey(), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            return objectMapper.readValue(cipher.doFinal(ciphertext), SECRET_CONFIG_TYPE);
        } catch (GeneralSecurityException | IllegalArgumentException | IOException e) {
            throw new IntegrationSecretEncryptionException("Unable to decrypt integration secret config", e);
        }
    }

    private byte[] deriveAesKey() throws GeneralSecurityException {
        return MessageDigest.getInstance("SHA-256").digest(encryptionKey.getBytes(StandardCharsets.UTF_8));
    }
}
