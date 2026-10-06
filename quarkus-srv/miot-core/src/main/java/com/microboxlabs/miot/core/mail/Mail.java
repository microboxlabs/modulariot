package com.microboxlabs.miot.core.mail;

/** One email to one recipient. {@code html} is optional; {@code text} is always sent. */
public record Mail(String to, String subject, String text, String html) {
}
