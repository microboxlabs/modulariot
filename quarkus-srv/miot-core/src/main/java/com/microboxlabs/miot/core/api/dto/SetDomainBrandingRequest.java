package com.microboxlabs.miot.core.api.dto;

/**
 * @param logoDataUrl base64 {@code data:} URL, e.g. {@code data:image/png;base64,iVBOR...}
 * @param homeUrl     absolute http(s) URL the logo links to; optional
 * @param active      defaults to true when omitted
 */
public record SetDomainBrandingRequest(
        String logoDataUrl,
        String homeUrl,
        Boolean active) {
}
