package com.microboxlabs.miot.core.branding;

/**
 * Everything the public metadata lookup needs, and nothing else.
 *
 * <p>Exists so that lookup does not load {@code logo_content}: it is an eagerly
 * fetched basic column, so reading the entity would pull up to 256 KB per row
 * only to discard it, on a query the sign-in page runs for every visitor.
 */
public record DomainBrandingMetadata(String domain, String logoEtag, String homeUrl) {
}
