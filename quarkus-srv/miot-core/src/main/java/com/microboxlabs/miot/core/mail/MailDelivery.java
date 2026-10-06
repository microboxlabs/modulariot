package com.microboxlabs.miot.core.mail;

/**
 * The outcome of handing an email to the mail provider. {@code SENT} means the provider accepted
 * it, not that it reached the inbox. {@code NOT_CONFIGURED} means no provider is set up for the
 * organization. {@code detail} explains a failure.
 */
public record MailDelivery(Status status, String detail) {

    public enum Status {
        SENT,
        FAILED,
        NOT_CONFIGURED
    }

    public static MailDelivery sent() {
        return new MailDelivery(Status.SENT, null);
    }

    public static MailDelivery failed(String detail) {
        return new MailDelivery(Status.FAILED, detail);
    }

    public static MailDelivery notConfigured(String detail) {
        return new MailDelivery(Status.NOT_CONFIGURED, detail);
    }

    public boolean isNotConfigured() {
        return status == Status.NOT_CONFIGURED;
    }
}
