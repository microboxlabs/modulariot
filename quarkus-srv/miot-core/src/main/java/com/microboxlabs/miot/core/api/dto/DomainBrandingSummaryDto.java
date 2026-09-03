package com.microboxlabs.miot.core.api.dto;

/**
 * Public branding for a domain, readable without authentication because the
 * sign-in page needs it before anyone has logged in.
 *
 * <p>Returned for any well-formed domain, with {@code hasLogo = false} when
 * nothing is configured, so a caller cannot use it to enumerate which hosts
 * this deployment serves.
 */
public record DomainBrandingSummaryDto(
        String domain,
        boolean hasLogo,
        String logoEtag,
        String homeUrl) {
}
