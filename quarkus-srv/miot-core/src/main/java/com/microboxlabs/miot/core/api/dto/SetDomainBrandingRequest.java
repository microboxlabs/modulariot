package com.microboxlabs.miot.core.api.dto;

/**
 * @param logoDataUrl     base64 {@code data:} URL, e.g. {@code data:image/png;base64,iVBOR...}
 * @param logoDarkDataUrl same, for dark backgrounds; optional. Absent or blank
 *     stores no dark variant, and clears one that was there — this is a
 *     replace, not a patch, so an edit that means to keep it resends it.
 * @param homeUrl         absolute http(s) URL the logo links to; optional
 * @param active          defaults to true when omitted
 */
public record SetDomainBrandingRequest(
        String logoDataUrl,
        String logoDarkDataUrl,
        String homeUrl,
        Boolean active) {
}
