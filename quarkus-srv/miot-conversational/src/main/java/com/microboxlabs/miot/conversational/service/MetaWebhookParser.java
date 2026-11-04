package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses the Meta WhatsApp Cloud API webhook envelope
 * ({@code entry[].changes[].value.{messages|statuses}}) into typed {@link InboundMessage} /
 * {@link StatusUpdate} records. Lenient by design: a malformed body or a value shape we don't
 * recognize yields no events rather than throwing, so the webhook always acks and Meta is never
 * pushed into a retry storm by a parse error. Pure + static — unit-tested directly.
 */
public final class MetaWebhookParser {

    private static final String ID = "id";
    private static final String MIME_TYPE = "mime_type";
    private static final String CAPTION = "caption";
    private static final String FILENAME = "filename";
    private static final String INTERACTIVE = "interactive";
    private static final String CALL_PERMISSION_REPLY = "call_permission_reply";

    private MetaWebhookParser() {
    }

    public static ParsedWebhook parse(byte[] rawBody) {
        List<InboundMessage> messages = new ArrayList<>();
        List<StatusUpdate> statuses = new ArrayList<>();
        List<CallPermissionReply> replies = new ArrayList<>();
        List<CallEvent> calls = new ArrayList<>();
        JsonObject root = readRoot(rawBody);
        if (root == null) {
            return new ParsedWebhook(messages, statuses, replies, calls);
        }
        JsonArray entries = root.getJsonArray("entry");
        for (int e = 0; entries != null && e < entries.size(); e++) {
            JsonObject entry = entries.getJsonObject(e);
            JsonArray changes = entry == null ? null : entry.getJsonArray("changes");
            for (int c = 0; changes != null && c < changes.size(); c++) {
                JsonObject change = changes.getJsonObject(c);
                JsonObject value = change == null ? null : change.getJsonObject("value");
                if (value != null) {
                    parseValue(value, messages, statuses);
                    parseCalling(value, replies, calls);
                }
            }
        }
        return new ParsedWebhook(messages, statuses, replies, calls);
    }

    private static JsonObject readRoot(byte[] rawBody) {
        if (rawBody == null || rawBody.length == 0) {
            return null;
        }
        try {
            return new JsonObject(new String(rawBody, StandardCharsets.UTF_8));
        } catch (RuntimeException malformed) {
            return null;
        }
    }

    private static void parseValue(JsonObject value, List<InboundMessage> messages, List<StatusUpdate> statuses) {
        JsonObject metadata = value.getJsonObject("metadata");
        String phoneNumberId = metadata == null ? null : metadata.getString("phone_number_id");
        String contactName = firstContactName(value.getJsonArray("contacts"));

        JsonArray msgs = value.getJsonArray("messages");
        for (int i = 0; msgs != null && i < msgs.size(); i++) {
            JsonObject m = msgs.getJsonObject(i);
            if (m != null) {
                messages.add(toInboundMessage(m, phoneNumberId, contactName));
            }
        }
        JsonArray sts = value.getJsonArray("statuses");
        for (int i = 0; sts != null && i < sts.size(); i++) {
            StatusUpdate parsed = toStatusUpdate(sts.getJsonObject(i));
            if (parsed != null) {
                statuses.add(parsed);
            }
        }
    }

    /** Call permission replies (from {@code messages}) and {@code calls} events. */
    private static void parseCalling(JsonObject value, List<CallPermissionReply> replies, List<CallEvent> calls) {
        JsonObject metadata = value.getJsonObject("metadata");
        String phoneNumberId = metadata == null ? null : metadata.getString("phone_number_id");
        JsonArray msgs = value.getJsonArray("messages");
        for (int i = 0; msgs != null && i < msgs.size(); i++) {
            CallPermissionReply reply = toCallPermissionReply(msgs.getJsonObject(i), phoneNumberId);
            if (reply != null) {
                replies.add(reply);
            }
        }
        JsonArray events = value.getJsonArray("calls");
        for (int i = 0; events != null && i < events.size(); i++) {
            CallEvent call = toCallEvent(events.getJsonObject(i), phoneNumberId);
            if (call != null) {
                calls.add(call);
            }
        }
    }

    private static JsonObject callPermissionReply(JsonObject m) {
        if (m == null || !INTERACTIVE.equals(m.getString("type"))) {
            return null;
        }
        JsonObject interactive = m.getJsonObject(INTERACTIVE);
        if (interactive == null || !CALL_PERMISSION_REPLY.equals(interactive.getString("type"))) {
            return null;
        }
        return interactive.getJsonObject(CALL_PERMISSION_REPLY);
    }

    private static CallPermissionReply toCallPermissionReply(JsonObject m, String phoneNumberId) {
        JsonObject reply = callPermissionReply(m);
        String from = m == null ? null : toE164(m.getString("from"));
        if (reply == null || from == null) {
            return null;
        }
        return new CallPermissionReply(
                phoneNumberId,
                from,
                m.getString(ID),
                nestedString(m, "context", ID),
                "accept".equalsIgnoreCase(reply.getString("response")),
                isTrue(reply.getValue("is_permanent")),
                epochSecondsToOffset(stringOf(reply.getValue("expiration_timestamp"))),
                reply.getString("response_source"),
                epochSecondsToOffset(m.getString("timestamp")));
    }

    private static CallEvent toCallEvent(JsonObject c, String phoneNumberId) {
        if (c == null || c.getString(ID) == null) {
            return null;
        }
        String direction = c.getString("direction");
        boolean business = CallEvent.BUSINESS_INITIATED.equalsIgnoreCase(direction);
        String contact = toE164(business ? c.getString("to") : c.getString("from"));
        boolean connected = c.getValue("start_time") != null || positive(c.getValue("duration"));
        return new CallEvent(phoneNumberId, c.getString(ID), contact, c.getString("event"), direction,
                c.getString("status"), connected, epochSecondsToOffset(stringOf(c.getValue("timestamp"))));
    }

    private static boolean positive(Object value) {
        if (value instanceof Number n) {
            return n.longValue() > 0;
        }
        try {
            return value != null && Long.parseLong(value.toString().trim()) > 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static boolean isTrue(Object value) {
        return value != null && "true".equalsIgnoreCase(value.toString());
    }

    private static String stringOf(Object value) {
        return value == null ? null : value.toString();
    }

    private static String firstContactName(JsonArray contacts) {
        if (contacts == null || contacts.isEmpty()) {
            return null;
        }
        JsonObject contact = contacts.getJsonObject(0);
        JsonObject profile = contact == null ? null : contact.getJsonObject("profile");
        return profile == null ? null : profile.getString("name");
    }

    private static InboundMessage toInboundMessage(JsonObject m, String phoneNumberId, String contactName) {
        ButtonReply button = buttonReply(m);
        JsonObject permission = callPermissionReply(m);
        MessageType type = button != null || permission != null ? MessageType.TEXT : mapType(m.getString("type"));
        MessageContent content;
        if (permission != null) {
            content = new MessageContent(permissionText(permission), null, null, null);
        } else if (button != null) {
            content = new MessageContent(button.text(), null, null, null);
        } else {
            content = extractContent(m, type);
        }
        return new InboundMessage(
                phoneNumberId,
                toE164(m.getString("from")),
                contactName,
                m.getString(ID),
                type,
                content.body(),
                content.mediaRef(),
                content.mediaMime(),
                content.mediaFileName(),
                epochSecondsToOffset(m.getString("timestamp")),
                nestedString(m, "context", ID),
                button == null ? null : button.payload());
    }

    /**
     * A quick-reply tap on a template ({@code type: button}, {@code button.payload/text}) or an
     * interactive reply ({@code type: interactive}, {@code button_reply} or {@code list_reply}
     * with {@code id/title}). Null for any other message.
     */
    private static ButtonReply buttonReply(JsonObject m) {
        String type = m.getString("type");
        if ("button".equals(type)) {
            JsonObject button = m.getJsonObject("button");
            return button == null ? null : new ButtonReply(button.getString("payload"), button.getString("text"));
        }
        if ("interactive".equals(type)) {
            JsonObject interactive = m.getJsonObject("interactive");
            if (interactive == null) {
                return null;
            }
            JsonObject reply = interactive.getJsonObject("button_reply");
            if (reply == null) {
                reply = interactive.getJsonObject("list_reply");
            }
            return reply == null ? null : new ButtonReply(reply.getString(ID), reply.getString("title"));
        }
        return null;
    }

    private record ButtonReply(String payload, String text) {
    }

    /** What the conversation shows for a call permission reply. */
    static String permissionText(JsonObject reply) {
        if (!"accept".equalsIgnoreCase(reply.getString("response"))) {
            return "Permiso de llamada rechazado";
        }
        return isTrue(reply.getValue("is_permanent"))
                ? "Permiso de llamada aceptado (permanente)"
                : "Permiso de llamada aceptado (temporal)";
    }

    /** Pulls body/media fields for a message by type; absent keys read as null. */
    private static MessageContent extractContent(JsonObject m, MessageType type) {
        if (type == MessageType.TEXT) {
            return new MessageContent(nestedString(m, "text", "body"), null, null, null);
        }
        String mediaKey = mediaKeyFor(type);
        JsonObject media = mediaKey == null ? null : m.getJsonObject(mediaKey);
        if (media == null) {
            return new MessageContent(null, null, null, null);
        }
        return new MessageContent(
                media.getString(CAPTION),
                media.getString(ID),
                media.getString(MIME_TYPE),
                media.getString(FILENAME));
    }

    private static String mediaKeyFor(MessageType type) {
        return switch (type) {
            case IMAGE -> "image";
            case DOCUMENT -> "document";
            case AUDIO -> "audio";
            case VIDEO -> "video";
            case STICKER -> "sticker";
            default -> null;
        };
    }

    private record MessageContent(String body, String mediaRef, String mediaMime, String mediaFileName) {
    }

    private static StatusUpdate toStatusUpdate(JsonObject s) {
        if (s == null) {
            return null;
        }
        String wamid = s.getString(ID);
        MessageStatus status = mapStatus(s.getString("status"));
        if (wamid == null || status == null) {
            return null;
        }
        return new StatusUpdate(
                wamid,
                status,
                toE164(s.getString("recipient_id")),
                firstError(s.getJsonArray("errors")),
                epochSecondsToOffset(s.getString("timestamp")));
    }

    private static String firstError(JsonArray errors) {
        if (errors == null || errors.isEmpty()) {
            return null;
        }
        JsonObject error = errors.getJsonObject(0);
        if (error == null) {
            return null;
        }
        String title = error.getString("title");
        Integer code = error.getInteger("code");
        if (title == null) {
            return code == null ? null : "Meta error " + code;
        }
        return code == null ? title : title + " (" + code + ")";
    }

    static MessageType mapType(String type) {
        if (type == null) {
            return MessageType.UNKNOWN;
        }
        return switch (type) {
            case "text" -> MessageType.TEXT;
            case "image" -> MessageType.IMAGE;
            case "document" -> MessageType.DOCUMENT;
            case "audio" -> MessageType.AUDIO;
            case "video" -> MessageType.VIDEO;
            case "sticker" -> MessageType.STICKER;
            default -> MessageType.UNKNOWN;
        };
    }

    static MessageStatus mapStatus(String status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case "sent" -> MessageStatus.SENT;
            case "delivered" -> MessageStatus.DELIVERED;
            case "read" -> MessageStatus.READ;
            case "failed" -> MessageStatus.FAILED;
            default -> null;
        };
    }

    /** Meta sends phone numbers as bare international digits; normalize to +E.164. */
    static String toE164(String waPhone) {
        if (waPhone == null) {
            return null;
        }
        String digits = waPhone.replaceAll("\\D", "");
        return digits.isEmpty() ? null : "+" + digits;
    }

    private static String nestedString(JsonObject parent, String childKey, String key) {
        JsonObject child = parent.getJsonObject(childKey);
        return child == null ? null : child.getString(key);
    }

    private static OffsetDateTime epochSecondsToOffset(String epochSeconds) {
        if (epochSeconds == null || epochSeconds.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.ofInstant(Instant.ofEpochSecond(Long.parseLong(epochSeconds.trim())), ZoneOffset.UTC);
        } catch (NumberFormatException | java.time.DateTimeException notEpoch) {
            return null;
        }
    }
}
