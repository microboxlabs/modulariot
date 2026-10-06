package com.microboxlabs.miot.integrations.email;

/**
 * One email to one recipient. {@code from} may be null to use the connection's sender;
 * {@code html} and {@code replyTo} are optional.
 */
public record EmailMessage(String from, String to, String subject, String text, String html, String replyTo) {

    public EmailMessage {
        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("to is required");
        }
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("subject is required");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("text is required");
        }
    }

    public EmailMessage withFrom(String sender) {
        return new EmailMessage(sender, to, subject, text, html, replyTo);
    }
}
