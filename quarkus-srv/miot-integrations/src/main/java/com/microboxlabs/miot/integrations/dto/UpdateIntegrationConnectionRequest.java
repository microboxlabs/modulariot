package com.microboxlabs.miot.integrations.dto;

import java.net.URI;
import java.util.Map;

/**
 * Partial update for an integration connection. Every field is optional — a {@code null}
 * field leaves the stored value unchanged. {@code metadata}, when present, replaces the
 * stored metadata wholesale (callers send the full object). A non-blank {@code token} and
 * each non-blank value of {@code secrets} set that key on the linked credential's secret; the
 * other keys are kept.
 *
 * <p>Enable/disable (the {@code active} flag) is intentionally not updatable here: the
 * lookup/update queries filter {@code AND active}, so toggling it off would make the row
 * unreachable. A dedicated, correctly-scoped activate/deactivate operation is a follow-up.
 */
public record UpdateIntegrationConnectionRequest(
        String name,
        URI baseUrl,
        Map<String, Object> metadata,
        /** Swaps the linked credential when non-null; a null leaves the current one in place. */
        String credentialProfileId,
        String token,
        Map<String, String> secrets) {

    public UpdateIntegrationConnectionRequest(
            String name, URI baseUrl, Map<String, Object> metadata, String credentialProfileId, String token) {
        this(name, baseUrl, metadata, credentialProfileId, token, null);
    }
}
