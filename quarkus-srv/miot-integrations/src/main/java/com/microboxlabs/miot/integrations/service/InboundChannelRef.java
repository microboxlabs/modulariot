package com.microboxlabs.miot.integrations.service;

/**
 * The org-routing result of an inbound Meta webhook lookup: which tenant owns the WHATSAPP
 * connection that received the event, and that connection's id (for logging / future
 * per-connection config). No secret is carried — inbound persistence only needs the tenant to
 * scope the conversation; we never send from the webhook path.
 */
public record InboundChannelRef(String tenantCode, String connectionId) {
}
