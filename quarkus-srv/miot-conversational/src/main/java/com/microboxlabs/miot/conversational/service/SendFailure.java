package com.microboxlabs.miot.conversational.service;

/** A queued message that did not go out; {@code retryable} when sending it again may work. */
public class SendFailure extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final boolean retryable;

    public SendFailure(String message, boolean retryable) {
        super(message);
        this.retryable = retryable;
    }

    public boolean retryable() {
        return retryable;
    }

    /** A provider's HTTP answer: a 4xx other than 429 will fail again, anything else may not. */
    public static boolean retryable(Integer httpStatus) {
        return httpStatus == null || httpStatus == 0 || httpStatus == 429 || httpStatus >= 500;
    }
}
