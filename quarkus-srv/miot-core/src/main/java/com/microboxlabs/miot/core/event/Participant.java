package com.microboxlabs.miot.core.event;

/**
 * Someone a conversation rule can message about an event's context.
 *
 * @param address   a phone in E.164 or an email
 * @param channel   {@code whatsapp} or {@code email}
 * @param name      how to address them; may be null
 * @param contactId their contact in the producer's contact book, when they have one
 * @param role      the role they were resolved for, such as {@code driver}
 */
public record Participant(String address, String channel, String name, String contactId, String role) {
}
