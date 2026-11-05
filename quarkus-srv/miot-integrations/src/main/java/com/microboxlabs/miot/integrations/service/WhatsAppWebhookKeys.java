package com.microboxlabs.miot.integrations.service;

/**
 * What an inbound Meta webhook needs from the WHATSAPP connection its URL names: the owning tenant, the verify
 * token Meta presents on subscription and the Meta App secret that signs each delivery. Both secrets are stored
 * on the connection's credential under {@link #APP_SECRET} and {@link #VERIFY_TOKEN}; a missing one is blank.
 */
public record WhatsAppWebhookKeys(String tenantCode, String connectionId, String appSecret, String verifyToken) {

    public static final String APP_SECRET = "app_secret";
    public static final String VERIFY_TOKEN = "verify_token";
}
