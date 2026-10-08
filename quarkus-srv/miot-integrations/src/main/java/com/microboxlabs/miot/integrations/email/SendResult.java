package com.microboxlabs.miot.integrations.email;

/**
 * What Resend answered. {@code accepted} means Resend took the email for delivery, not that it
 * reached the inbox. {@code status} is 0 when Resend could not be reached.
 */
public record SendResult(boolean accepted, int status, String messageId, String error) {

    public static SendResult accepted(int status, String messageId) {
        return new SendResult(true, status, messageId, null);
    }

    public static SendResult failed(int status, String error) {
        return new SendResult(false, status, null, error);
    }
}
