package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Partial update of a credential. A null field is left as it was.
 *
 * <p>{@code secretConfig} is the rotation trigger and is expected to be absent most of
 * the time: the edit form cannot show a stored secret, so it submits an empty one to
 * mean "keep it". An absent or empty secret leaves both the ciphertext and
 * {@code secretVersion} untouched.
 *
 * <p>The credential type is not updatable: one that changes type is a different
 * credential, with a different config shape and a different secret.
 */
public record UpdateCredentialProfileRequest(
        String displayName,
        String environment,
        Map<String, Object> publicConfig,
        Map<String, Object> secretConfig) {
}
