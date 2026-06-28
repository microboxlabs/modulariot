package com.microboxlabs.miot.integrations.dto;

import java.net.URI;
import java.util.Map;

/**
 * Partial update for an integration connection. Every field is optional — a {@code null}
 * field leaves the stored value unchanged. {@code metadata}, when present, replaces the
 * stored metadata wholesale (callers send the full object). A non-blank {@code token}
 * rotates the secret on the linked credential profile.
 *
 * <p>Enable/disable (the {@code active} flag) is intentionally not updatable here: the
 * lookup/update queries filter {@code AND active}, so toggling it off would make the row
 * unreachable. A dedicated, correctly-scoped activate/deactivate operation is a follow-up.
 */
public record UpdateIntegrationConnectionRequest(
        String name,
        URI baseUrl,
        Map<String, Object> metadata,
        String token) {
}
