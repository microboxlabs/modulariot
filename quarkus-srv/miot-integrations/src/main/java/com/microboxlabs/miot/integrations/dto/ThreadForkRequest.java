package com.microboxlabs.miot.integrations.dto;

/**
 * Copies a thread into a new one owned by the caller. {@code atMessageId}
 * keeps that message and its ancestors only; null copies every message.
 */
public record ThreadForkRequest(String atMessageId) {
}
