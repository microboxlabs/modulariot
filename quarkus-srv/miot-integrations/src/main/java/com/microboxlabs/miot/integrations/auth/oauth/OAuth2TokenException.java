package com.microboxlabs.miot.integrations.auth.oauth;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;

/**
 * A token endpoint answered, and said no. Carries the two things an operator can act on
 * — the HTTP status and the RFC 6749 {@code error} code ({@code invalid_client},
 * {@code unauthorized_client}, …) — and deliberately not the response body, which
 * providers fill with correlation ids and echoed request detail.
 */
public class OAuth2TokenException extends AuthResolutionException {

    private final int statusCode;
    private final String errorCode;

    public OAuth2TokenException(String message, int statusCode, String errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public int statusCode() {
        return statusCode;
    }

    /** The provider's {@code error} code, or {@code null} when it sent none we could read. */
    public String errorCode() {
        return errorCode;
    }
}
