package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import org.jboss.logging.Logger;

/**
 * Applies a verified Telnyx call-control webhook to the ledger. The browser passes the ledger row's id as the
 * call's {@code client_state}; Telnyx echoes it, so the row is found without trusting anything else the browser
 * says. {@code call.answered} sets when the callee answered; {@code call.hangup} confirms the call with the
 * seconds from the answer to the hangup. An incoming call to the shared number is routed by {@link InboundRouter}.
 */
@ApplicationScoped
public class TelnyxCallEvents {

    private static final Logger LOG = Logger.getLogger(TelnyxCallEvents.class);

    /** What the webhook did, for the response and the tests. */
    public record Outcome(String event, String rowId, String status, String routedTenant) {
    }

    private final TelephonyUsageStore usage;
    private final InboundRouter inbound;
    private final ObjectMapper json;
    private final Clock clock;
    private final TelnyxParkedCalls parked;

    @Inject
    public TelnyxCallEvents(TelephonyUsageStore usage, InboundRouter inbound, ObjectMapper json, TelnyxParkedCalls parked) {
        this(usage, inbound, json, Clock.systemUTC(), parked);
    }

    public TelnyxCallEvents(TelephonyUsageStore usage, InboundRouter inbound, ObjectMapper json) {
        this(usage, inbound, json, Clock.systemUTC(), null);
    }

    public TelnyxCallEvents(TelephonyUsageStore usage, InboundRouter inbound, ObjectMapper json, Clock clock) {
        this(usage, inbound, json, clock, null);
    }

    public TelnyxCallEvents(TelephonyUsageStore usage, InboundRouter inbound, ObjectMapper json, Clock clock,
            TelnyxParkedCalls parked) {
        this.usage = usage;
        this.inbound = inbound;
        this.json = json;
        this.clock = clock;
        this.parked = parked;
    }

    /** {@code connectionId}: the connection the webhook URL names; rows of another connection are ignored. */
    public Outcome apply(String connectionId, String body) {
        JsonNode data;
        try {
            data = json.readTree(body).path("data");
        } catch (IOException e) {
            throw new IllegalArgumentException("the webhook body is not JSON");
        }
        String event = data.path("event_type").asText("");
        JsonNode p = data.path("payload");
        Instant at = time(data.path("occurred_at").asText(null));
        String callControlId = text(p, "call_control_id");
        if (parked != null) {
            TelnyxParkedCalls.Handling handling = parked.handle(connectionId, event, p);
            if (handling.handled()) return new Outcome(event, null, null, null);
            if (handling.callRef() != null) {
                p = p.deepCopy();
                ((com.fasterxml.jackson.databind.node.ObjectNode) p).put("client_state",
                        Base64.getEncoder().encodeToString(handling.callRef().getBytes(StandardCharsets.UTF_8)));
            }
        }
        if ("call.initiated".equals(event) && "incoming".equals(text(p, "direction"))) {
            String tenant = inbound.route(text(p, "from"), at).orElse(null);
            LOG.infof("Telnyx inbound call routed to %s", tenant == null ? "the platform notice" : tenant);
            return new Outcome(event, null, null, tenant);
        }
        JsonNode payload = p;
        return usage.locked(connectionId, () -> applyLocked(connectionId, event, payload, at, callControlId));
    }

    private Outcome applyLocked(String connectionId, String event, JsonNode p, Instant at, String callControlId) {
        if (callControlId == null) return new Outcome(event, null, null, null);
        String ref = decode(text(p, "client_state"));
        UsageRow token = ref == null ? null : usage.find(ref).orElse(null);
        if (token != null && (!connectionId.equals(token.connectionId())
                || !(UsageRow.VOICE.equals(token.channel()) || UsageRow.WHATSAPP_CALL.equals(token.channel()))
                || (token.externalId() != null && !callControlId.equals(token.externalId())))) token = null;
        UsageRow canonical = usage.findByExternal(token != null ? token.channel() : UsageRow.VOICE, callControlId)
                .orElse(null);
        if (canonical != null && (!connectionId.equals(canonical.connectionId())
                || (token != null && !canonical.tenantCode().equals(token.tenantCode())))) {
            return new Outcome(event, null, null, null);
        }
        UsageRow r = canonical != null ? canonical : token;
        if (r == null) return new Outcome(event, null, null, null);
        if (canonical != null && token != null && !canonical.id().equals(token.id())) {
            usage.update(token.retired());
            // Correlation may add a case reference, but never change provider-confirmed billing data.
            if (r.caseRef() == null) r = r.providerData(r.externalId(), r.calleeNumber(), r.startedAt(),
                    r.answeredAt(), token.caseRef());
        }
        if (!UsageRow.SOURCE_DETAIL_RECORD.equals(r.source())) {
            String callee = PhoneNumbers.e164(text(p, "to"));
            // A WhatsApp leg's "to" is a SIP address: the contact's number stays the one reserved.
            if (callee == null && (r.externalId() != null || !UsageRow.VOICE.equals(r.channel()))) {
                callee = r.calleeNumber();
            }
            r = r.providerData(callControlId, callee, time(text(p, "start_time")), r.answeredAt(), r.caseRef());
            if ("call.answered".equals(event) && r.answeredAt() == null) {
                r = r.providerData(callControlId, r.calleeNumber(), r.startedAt(), at, r.caseRef());
            }
            if ("call.hangup".equals(event) || ("call.answered".equals(event)
                    && UsageRow.SOURCE_WEBHOOK.equals(r.source()) && r.endedAt() != null)) {
                Instant end = "call.hangup".equals(event)
                        ? (time(text(p, "end_time")) != null ? time(text(p, "end_time")) : at) : r.endedAt();
                long elapsed = r.answeredAt() == null || end == null ? 0
                        : Math.max(0, Duration.between(r.answeredAt(), end).toSeconds());
                r = r.confirmed((int) Math.min(Integer.MAX_VALUE, elapsed), null, null,
                        UsageRow.SOURCE_WEBHOOK, end, clock.instant());
            }
        }
        usage.update(r);
        return new Outcome(event, r.id(), r.status(), null);
    }

    /** {@code client_state} is base64 of the row id. */
    static String decode(String clientState) {
        if (clientState == null || clientState.isBlank()) {
            return null;
        }
        try {
            return new String(Base64.getDecoder().decode(clientState.trim()), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }

    private static Instant time(String value) {
        try {
            return value == null ? null : Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
