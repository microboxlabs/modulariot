package com.microboxlabs.miot.conversational.service;

import java.util.List;

/** The two ingestable kinds of event a Meta webhook POST can carry, after parsing. */
public record ParsedWebhook(List<InboundMessage> messages, List<StatusUpdate> statuses) {
}
