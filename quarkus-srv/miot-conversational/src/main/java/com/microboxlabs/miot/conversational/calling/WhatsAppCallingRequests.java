package com.microboxlabs.miot.conversational.calling;

import io.vertx.core.json.JsonObject;

/**
 * The Graph API bodies for WhatsApp calling, built and not sent: the sender is the next step (see the doc).
 * Paths are relative to the WHATSAPP connection's base URL and phone number id.
 */
public final class WhatsAppCallingRequests {

    private WhatsAppCallingRequests() {
    }

    /** {@code POST /{phone-number-id}/settings}: turns calling on for the number. */
    public static JsonObject enableCalling() {
        return new JsonObject().put("calling", new JsonObject()
                .put("status", "ENABLED")
                .put("call_icon_visibility", "DEFAULT")
                .put("callback_permission_status", "ENABLED"));
    }

    /** {@code POST /{phone-number-id}/messages}: asks the user for permission to call. */
    public static JsonObject permissionRequest(String to, String bodyText) {
        return new JsonObject()
                .put("messaging_product", "whatsapp")
                .put("recipient_type", "individual")
                .put("to", to)
                .put("type", "interactive")
                .put("interactive", new JsonObject()
                        .put("type", "call_permission_request")
                        .put("action", new JsonObject().put("name", "call_permission_request"))
                        .put("body", new JsonObject().put("text", bodyText)));
    }

    /** {@code POST /{phone-number-id}/calls}: places a call with the browser's SDP offer. */
    public static JsonObject connect(String to, String sdpOffer) {
        if (sdpOffer == null || sdpOffer.isBlank()) {
            throw new IllegalArgumentException("an SDP offer is required");
        }
        return new JsonObject()
                .put("messaging_product", "whatsapp")
                .put("to", to)
                .put("action", "connect")
                .put("session", new JsonObject().put("sdp_type", "offer").put("sdp", sdpOffer));
    }

    /** {@code POST /{phone-number-id}/calls}: ends a call. */
    public static JsonObject terminate(String callId) {
        return new JsonObject().put("messaging_product", "whatsapp").put("call_id", callId)
                .put("action", "terminate");
    }
}
