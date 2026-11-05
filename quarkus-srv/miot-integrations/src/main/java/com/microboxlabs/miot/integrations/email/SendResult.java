package com.microboxlabs.miot.integrations.email;

/**
 * What Resend answered. {@code accepted} means Resend took the email for delivery, not that it
 * reached the inbox. {@code status} is 0 for a transport or local configuration failure;
 * {@code retryable} distinguishes the two.
 */
public record SendResult(boolean accepted, int status, String messageId, String error, boolean retryable) {

    public static SendResult accepted(int status, String messageId) {
        return new SendResult(true, status, messageId, null, false);
    }

    public static SendResult failed(int status, String error) {
        return new SendResult(false, status, null, error,
                status == 0 || status == 429 || status >= 500);
    }

    public static SendResult failedPermanently(String error) {
        return new SendResult(false, 0, null, error, false);
    }
}
