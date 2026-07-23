package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.util.Map;

/**
 * Both {@code credentialType} and {@code environment} are optional so callers that
 * predate the credentials screen keep working: the WhatsApp channel posts only an
 * {@code authType}, and the service derives the type from it and files the credential
 * under the default environment.
 *
 * @param authType optional; defaults to the type's own auth type. Supply it only to
 *                 pin a placement the type cannot express (an API key in the query
 *                 string rather than a header).
 */
public record CreateCredentialProfileRequest(
        String displayName,
        CredentialType credentialType,
        AuthType authType,
        String environment,
        Map<String, Object> publicConfig,
        Map<String, Object> secretConfig) {
}
