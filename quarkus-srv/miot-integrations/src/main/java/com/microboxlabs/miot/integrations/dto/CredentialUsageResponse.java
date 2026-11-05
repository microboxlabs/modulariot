package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.CredentialUsageKind;
import com.microboxlabs.miot.integrations.domain.ProviderType;

/**
 * One consumer of a credential, as returned alongside the credential itself.
 *
 * @param detail what identifies the connection: a WhatsApp phone number id, a Resend sender, else the base URL;
 *               null when it has none
 */
public record CredentialUsageResponse(
        String id,
        String label,
        CredentialUsageKind kind,
        ProviderType providerType,
        String detail) {
}
