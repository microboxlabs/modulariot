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
import java.util.Optional;
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

    @Inject
    public TelnyxCallEvents(TelephonyUsageStore usage, InboundRouter inbound, ObjectMapper json) {
        this(usage, inbound, json, Clock.systemUTC());
    }

    public TelnyxCallEvents(TelephonyUsageStore usage, InboundRouter inbound, ObjectMapper json, Clock clock) {
        this.usage = usage;
        this.inbound = inbound;
        this.json = json;
        this.clock = clock;
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
        if ("call.initiated".equals(event) && "incoming".equals(text(p, "direction"))) {
            String tenant = inbound.route(text(p, "from"), at).orElse(null);
            LOG.infof("Telnyx inbound call routed to %s", tenant == null ? "the platform notice" : tenant);
            return new Outcome(event, null, null, tenant);
        }
        Optional<UsageRow> found = row(text(p, "client_state"), callControlId);
        if (found.isEmpty() || !connectionId.equals(found.get().connectionId())) {
            return new Outcome(event, null, null, null);
        }
        UsageRow r = found.get();
        if (callControlId != null && r.externalId() == null
                && usage.findByExternal(r.channel(), callControlId).isEmpty()) {
            r = withExternal(r, callControlId);
        }
        switch (event) {
            case "call.answered" -> r = answered(r, at);
            case "call.hangup" -> {
                if (!UsageRow.CONFIRMED.equals(r.status())) {
                    Instant end = time(text(p, "end_time")) != null ? time(text(p, "end_time")) : at;
                    int seconds = r.answeredAt() == null || end == null ? 0
                            : (int) Math.max(0, Duration.between(r.answeredAt(), end).toSeconds());
                    r = r.confirmed(seconds, null, null, UsageRow.SOURCE_WEBHOOK, end, clock.instant());
                }
            }
            default -> {
            }
        }
        usage.update(r);
        return new Outcome(event, r.id(), r.status(), null);
    }

    private Optional<UsageRow> row(String clientState, String callControlId) {
        String ref = decode(clientState);
        Optional<UsageRow> byRef = ref == null ? Optional.empty() : usage.find(ref);
        if (byRef.isPresent()) {
            return byRef;
        }
        return callControlId == null ? Optional.empty() : usage.findByExternal(UsageRow.VOICE, callControlId);
    }

    private static UsageRow answered(UsageRow r, Instant at) {
        if (r.answeredAt() != null) {
            return r;
        }
        return new UsageRow(r.id(), r.tenantCode(), r.channel(), r.managed(), r.connectionId(), r.externalId(),
                r.caseRef(), r.calleeNumber(), r.destinationType(), r.status(), at, r.seconds(), r.billedMinutes(),
                r.providerCost(), r.providerCurrency(), r.source(), r.startedAt(), r.endedAt(), r.confirmedAt());
    }

    private static UsageRow withExternal(UsageRow r, String externalId) {
        return new UsageRow(r.id(), r.tenantCode(), r.channel(), r.managed(), r.connectionId(), externalId,
                r.caseRef(), r.calleeNumber(), r.destinationType(), r.status(), r.answeredAt(), r.seconds(),
                r.billedMinutes(), r.providerCost(), r.providerCurrency(), r.source(), r.startedAt(), r.endedAt(),
                r.confirmedAt());
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
