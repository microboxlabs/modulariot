package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.util.Map;

/**
 * A credential to exercise without saving it, so an operator can find out a client
 * secret is wrong before storing it. Carries the same halves as the create request; the
 * secret is used for the one token request and never written anywhere.
 */
public record CredentialTestRequest(
        CredentialType credentialType,
        Map<String, Object> publicConfig,
        Map<String, Object> secretConfig) {
}
