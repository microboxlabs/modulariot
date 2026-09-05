package com.microboxlabs.miot.core.api.dto;

import java.time.Instant;

/**
 * Administrative view of one domain's branding. Carries the logo's metadata
 * but never its bytes — clients render the image from
 * {@code GET /branding/{domain}/logo}, which the browser can cache.
 */
public record DomainBrandingDto(
        String domain,
        String logoMime,
        String logoEtag,
        /** Null when the domain ships one logo for both grounds. */
        String logoDarkMime,
        String logoDarkEtag,
        String homeUrl,
        boolean active,
        Instant updatedAt,
        String updatedBy) {
}
