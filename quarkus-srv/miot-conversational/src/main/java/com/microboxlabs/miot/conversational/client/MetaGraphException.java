package com.microboxlabs.miot.conversational.client;

/**
 * A Meta Graph API call that did not succeed. {@link #httpStatus()} is Meta's HTTP status, or {@code null}
 * when the request never reached Meta; {@link #code()} is Meta's {@code error.code} when it sent one. The
 * message prefers Meta's text for people ({@code error_user_title}, {@code error_user_msg}).
 */
public class MetaGraphException extends RuntimeException {

    /** Meta's code for an expired or invalid access token. */
    public static final int INVALID_TOKEN = 190;

    private final Integer httpStatus;
    private final Integer code;

    public MetaGraphException(String message, Integer httpStatus, Integer code, Throwable cause) {
        super(message, cause);
        this.httpStatus = httpStatus;
        this.code = code;
    }

    public Integer httpStatus() {
        return httpStatus;
    }

    public Integer code() {
        return code;
    }

    /** Meta refused the request itself (bad input, unknown template), not the token, a rate limit or its own service. */
    public boolean isClientError() {
        return httpStatus != null && httpStatus >= 400 && httpStatus < 500 && httpStatus != 401
                && httpStatus != 403 && httpStatus != 429 && (code == null || code != INVALID_TOKEN);
    }
}
