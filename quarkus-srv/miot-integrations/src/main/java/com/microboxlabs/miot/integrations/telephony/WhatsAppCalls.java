package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.InboundCallers;
import com.microboxlabs.miot.core.telephony.InboundCallers.Caller;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.telephony.TelnyxParkedCalls.Handling;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.jboss.logging.Logger;

/**
 * WhatsApp voice calls over SIP through the WhatsApp Call Control application. The operator's browser leg is
 * always a parked leg on the operators' credential connection, admitted like a PSTN call
 * ({@link TelnyxParkedCalls}); only what happens on admission differs:
 *
 * <ul>
 * <li>Outbound: the server dials the contact on WhatsApp ({@link TelnyxClient#dialWhatsApp}) and bridges the two
 * legs when WhatsApp answers. A SIP 403 from Meta means the contact has not allowed calls.</li>
 * <li>Inbound: a contact's call is parked (it rings) and offered to the operators of the organization that knows
 * the caller. The first operator to take it places a parked leg; on admission the server answers the WhatsApp
 * leg and bridges them. Nobody in {@link WhatsAppSipConfig#ringTimeout()}, or an unknown caller: a short message,
 * then hang up.</li>
 * </ul>
 *
 * The WhatsApp leg carries {@code client_state} {@code wa:<admission target state>}, so its answer and hangup
 * confirm the operator's ledger row like a PSTN leg does.
 */
@ApplicationScoped
public class WhatsAppCalls {

    private static final Logger LOG = Logger.getLogger(WhatsAppCalls.class);
    static final String LEG = "wa:";
    static final String BYE = "wa-bye:";
    static final String SIP_FORBIDDEN = "403";

    private final WhatsAppSipConfig config;
    private final TelephonyUsageStore usage;
    private final WhatsAppCallStore store;
    private final TelnyxClient client;
    private final UnaryOperator<String> apiKeys;
    private final InboundCallers callers;
    private final InboundRouter router;
    private final ObjectMapper json;
    private final Clock clock;

    @Inject
    public WhatsAppCalls(WhatsAppSipConfig config, TelephonyUsageStore usage, WhatsAppCallStore store,
            TelnyxClient client, IntegrationConnectionRepository connections, IntegrationConnectionResolver resolver,
            InboundCallers callers, InboundRouter router, ObjectMapper json) {
        this(new SipGateway(config, client, connectionId -> {
            IntegrationConnection c = connections.findActiveTelnyxById(connectionId);
            if (c == null || !client.serves(c.baseUrl())) {
                throw new TelephonyUnavailableException("The Telnyx line is unavailable");
            }
            return resolver.resolve(c.tenantCode(), c).secretString(TelephonyKeys.TOKEN);
        }), usage, store, callers, router, json, Clock.systemUTC());
    }

    /** The configured SIP gateway and the API key of a TELNYX connection, by id. */
    public record SipGateway(WhatsAppSipConfig config, TelnyxClient client, UnaryOperator<String> apiKeys) {
    }

    public WhatsAppCalls(SipGateway gateway, TelephonyUsageStore usage, WhatsAppCallStore store,
            InboundCallers callers, InboundRouter router, ObjectMapper json, Clock clock) {
        this.config = gateway.config();
        this.usage = usage;
        this.store = store;
        this.client = gateway.client();
        this.apiKeys = gateway.apiKeys();
        this.callers = callers;
        this.router = router;
        this.json = json;
        this.clock = clock;
    }

    public boolean enabled() {
        return config.enabled();
    }

    /** Whether a verified webhook is about a WhatsApp leg. */
    boolean owns(JsonNode payload, String state) {
        return state != null && (state.startsWith(LEG) || state.startsWith(BYE))
                || config.isApplication(text(payload, "connection_id"));
    }

    /** Handles a WhatsApp leg's event; not handled means the ledger should apply it to {@code callRef}. */
    Handling handle(String connectionId, String event, JsonNode p, String state) {
        String callId = text(p, "call_control_id");
        if (callId == null) return new Handling(true, null);
        if (state != null && state.startsWith(LEG)) {
            return usage.locked(connectionId, () -> leg(connectionId, event, p, callId, state.substring(LEG.length())));
        }
        if (state != null && state.startsWith(BYE)) {
            farewell(connectionId, event, callId);
            return new Handling(true, null);
        }
        if ("call.initiated".equals(event) && "incoming".equals(text(p, "direction"))) {
            usage.locked(connectionId, () -> ring(connectionId, callId, text(p, "from")));
            return new Handling(true, null);
        }
        if ("call.hangup".equals(event)) {
            usage.locked(connectionId, () -> {
                store.inboundByCallControl(callId).ifPresent(c -> callerHungUp(connectionId, c));
                return true;
            });
        }
        return new Handling(true, null);
    }

    private Handling leg(String connectionId, String event, JsonNode p, String callId, String targetState) {
        CallAdmission admission = usage.admissionByTargetState(targetState).orElse(null);
        UsageRow row = admission == null ? null : usage.find(admission.callRef()).orElse(null);
        if (row == null || !connectionId.equals(row.connectionId()) || !UsageRow.WHATSAPP_CALL.equals(row.channel())) {
            if ("call.initiated".equals(event)) hangup(connectionId, callId);
            return new Handling(true, null);
        }
        String saved = store.leg(row.id()).orElse(null);
        if (saved == null) store.saveLeg(row.id(), callId);
        String leg = saved == null ? callId : saved;
        if (!leg.equals(callId)) return new Handling(true, null);
        Optional<InboundWhatsAppCall> inbound = store.inboundByCallRef(row.id());
        if ("call.answered".equals(event) && row.endedAt() == null) {
            require(() -> client.bridge(apiKeys.apply(connectionId), admission.parkedCallId(), leg, row.id() + ":bridge"),
                    "bridge the WhatsApp call");
            inbound.ifPresent(c -> store.updateInbound(c.with(InboundWhatsAppCall.ANSWERED, c.callRef(), clock.instant())));
        } else if ("call.hangup".equals(event)) {
            if (row.answeredAt() == null && SIP_FORBIDDEN.equals(text(p, "sip_hangup_cause"))) {
                store.saveFailure(row.id(), TelephonyUnavailableException.WHATSAPP_NO_PERMISSION);
            }
            hangup(connectionId, admission.parkedCallId());
            inbound.ifPresent(c -> store.updateInbound(c.with(InboundWhatsAppCall.ENDED, c.callRef(), clock.instant())));
        }
        return new Handling(false, row.id());
    }

    /**
     * The operator's parked leg was admitted for a WhatsApp row: answer the claimed inbound call, or dial the
     * contact. Called again on webhook retries; dials once.
     */
    void connect(String connectionId, CallAdmission admission, UsageRow row) {
        String legState = encode(LEG + admission.targetState());
        String apiKey = apiKeys.apply(connectionId);
        InboundWhatsAppCall inbound = store.inboundByCallRef(row.id()).orElse(null);
        if (inbound != null) {
            if (InboundWhatsAppCall.ANSWERED.equals(inbound.status())) return;
            if (!InboundWhatsAppCall.CLAIMED.equals(inbound.status())) {
                hangup(connectionId, admission.parkedCallId());
                return;
            }
            usage.locked(connectionId, () -> {
                if (store.leg(row.id()).isEmpty()) store.saveLeg(row.id(), inbound.callControlId());
                return true;
            });
            require(() -> client.answer(apiKey, inbound.callControlId(), legState, row.id() + ":answer"),
                    "answer the WhatsApp call");
            return;
        }
        if (store.leg(row.id()).isPresent()) return;
        if (!config.enabled()) {
            hangup(connectionId, admission.parkedCallId());
            return;
        }
        int limit = (int) Math.max(30, Duration.between(clock.instant(),
                row.startedAt().plus(IntegrationsTelephony.HOLD)).toSeconds() - 60);
        HttpResponse<String> response = require(() -> client.dialWhatsApp(apiKey, new TelnyxClient.WhatsAppDial(
                config.connectionId(), config.to(row.calleeNumber()), config.from(), config.sipUsername(),
                config.sipPassword(), config.mediaEncryption(), legState, row.id(), admission.parkedCallId(), limit)),
                "dial WhatsApp");
        String legId = callControlId(response.body());
        if (legId != null) {
            usage.locked(connectionId, () -> {
                if (store.leg(row.id()).isEmpty()) store.saveLeg(row.id(), legId);
                return true;
            });
        }
    }

    /** The operator's parked leg ended: the WhatsApp leg ends with it. */
    void parkedHungUp(String connectionId, UsageRow row) {
        usage.locked(connectionId, () -> {
            store.leg(row.id()).ifPresent(leg -> hangup(connectionId, leg));
            store.inboundByCallRef(row.id()).ifPresent(c -> {
                if (!InboundWhatsAppCall.ENDED.equals(c.status())) {
                    hangup(connectionId, c.callControlId());
                    store.updateInbound(c.with(InboundWhatsAppCall.ENDED, c.callRef(), clock.instant()));
                }
            });
            return true;
        });
    }

    private boolean ring(String connectionId, String callId, String from) {
        if (store.inboundByCallControl(callId).isPresent()) return true;
        String caller = callerE164(from);
        Instant now = clock.instant();
        InboundCallers.Lookup lookup = caller == null ? new InboundCallers.Lookup(Optional.empty(), false)
                : callers.lookup(caller);
        Caller who = lookup.caller().orElse(null);
        if (who == null && caller != null && !lookup.ambiguous()) {
            who = router.route(caller, now).map(t -> new Caller(t, null, null)).orElse(null);
        }
        String tenant = who == null ? null : who.tenantCode();
        InboundWhatsAppCall call = new InboundWhatsAppCall(UUID.randomUUID().toString(), connectionId, callId, tenant,
                caller == null ? "unknown" : caller, who == null ? null : who.name(), who == null ? null : who.caseRef(),
                tenant == null ? InboundWhatsAppCall.MISSED : InboundWhatsAppCall.RINGING, null, now, now);
        store.insertInbound(call);
        LOG.infof("WhatsApp inbound call %s %s", call.id(), tenant == null ? "from an unknown caller" : "for " + tenant);
        if (tenant == null) answerForMessage(connectionId, call);
        return true;
    }

    private void callerHungUp(String connectionId, InboundWhatsAppCall c) {
        if (InboundWhatsAppCall.RINGING.equals(c.status())) {
            store.updateInbound(c.with(InboundWhatsAppCall.MISSED, null, clock.instant()));
        } else if (InboundWhatsAppCall.CLAIMED.equals(c.status())) {
            Optional<CallAdmission> admission = usage.admission(c.callRef());
            if (admission.isPresent()) hangup(connectionId, admission.get().parkedCallId());
            else usage.find(c.callRef()).ifPresent(r -> usage.update(r.retired()));
            store.updateInbound(c.with(InboundWhatsAppCall.ENDED, c.callRef(), clock.instant()));
        }
    }

    /** Ringing calls nobody took in time: the message, then hang up. */
    @Scheduled(every = "${miot.integrations.whatsapp-calling.ring-check:5s}", delayed = "30s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledExpire() {
        if (!config.enabled()) return;
        try {
            expireRinging();
            expireActive();
        } catch (RuntimeException e) {
            LOG.warnf("WhatsApp ringing check failed: %s", e.getMessage());
        }
    }

    public int expireRinging() {
        Instant now = clock.instant();
        int missed = 0;
        for (InboundWhatsAppCall c : store.unansweredBefore(now.minus(config.ringTimeout()))) {
            if (usage.locked(c.connectionId(), () -> expireUnanswered(c.id(), now))) missed++;
        }
        return missed;
    }

    private boolean expireUnanswered(String id, Instant now) {
        InboundWhatsAppCall current = store.inbound(id).orElse(null);
        if (current == null) return false;
        if (InboundWhatsAppCall.CLAIMED.equals(current.status())) {
            if (usage.admission(current.callRef()).isPresent()) return false;
            usage.find(current.callRef()).ifPresent(r -> usage.update(r.retired()));
        } else if (!InboundWhatsAppCall.RINGING.equals(current.status())) {
            return false;
        }
        InboundWhatsAppCall missed = current.with(InboundWhatsAppCall.MISSED, null, now);
        store.updateInbound(missed);
        answerForMessage(current.connectionId(), missed);
        return true;
    }

    /** Bound inbound calls like outbound legs; do not free their channel until teardown succeeds. */
    public int expireActive() {
        Instant now = clock.instant();
        int ended = 0;
        for (InboundWhatsAppCall call : store.activeBefore(now.minus(IntegrationsTelephony.HOLD).plusSeconds(60))) {
            if (usage.locked(call.connectionId(), () -> endOverdue(call.id(), now))) ended++;
        }
        return ended;
    }

    private boolean endOverdue(String id, Instant now) {
        InboundWhatsAppCall call = store.inbound(id).orElse(null);
        if (call == null || !(InboundWhatsAppCall.CLAIMED.equals(call.status())
                || InboundWhatsAppCall.ANSWERED.equals(call.status()))) return false;
        UsageRow row = usage.find(call.callRef()).orElse(null);
        if (row == null || row.startedAt().plus(IntegrationsTelephony.HOLD).minusSeconds(60).isAfter(now)) return false;
        hangup(call.connectionId(), call.callControlId());
        usage.admission(row.id()).ifPresent(a -> hangup(call.connectionId(), a.parkedCallId()));
        if (row.endedAt() == null && !UsageRow.CONFIRMED.equals(row.status())) usage.update(row.endedPending(now));
        store.updateInbound(call.with(InboundWhatsAppCall.ENDED, call.callRef(), now));
        return true;
    }

    /** The tenant's ringing calls, oldest first. */
    public List<InboundWhatsAppCall> ringing(String tenantCode) {
        return store.ringing(tenantCode);
    }

    /** Called under the line's lock: the operator's row {@code callRef} takes the ringing call. */
    InboundWhatsAppCall claim(String tenantCode, String inboundId, String callRef) {
        InboundWhatsAppCall c = store.inbound(inboundId).orElse(null);
        if (c == null || !tenantCode.equals(c.tenantCode()) || !InboundWhatsAppCall.RINGING.equals(c.status())) {
            throw new TelephonyUnavailableException(TelephonyUnavailableException.WHATSAPP_CALL_TAKEN,
                    "The WhatsApp call is no longer ringing");
        }
        InboundWhatsAppCall claimed = c.with(InboundWhatsAppCall.CLAIMED, callRef, clock.instant());
        store.updateInbound(claimed);
        return claimed;
    }

    /** Called under the line's lock when the operator's login failed: the call rings again. */
    void unclaim(String callRef) {
        store.inboundByCallRef(callRef).filter(c -> InboundWhatsAppCall.CLAIMED.equals(c.status()))
                .ifPresent(c -> store.updateInbound(c.with(InboundWhatsAppCall.RINGING, null, clock.instant())));
    }

    Optional<InboundWhatsAppCall> inbound(String id) {
        return store.inbound(id);
    }

    Optional<String> failure(String callRef) {
        return store.failure(callRef);
    }

    private void farewell(String connectionId, String event, String callId) {
        if ("call.answered".equals(event)) {
            String text = config.unansweredMessage();
            if (text == null || text.isBlank()) {
                hangup(connectionId, callId);
                return;
            }
            try {
                if (!ok(client.speak(apiKeys.apply(connectionId), callId, text, encode(BYE)).statusCode())) {
                    hangup(connectionId, callId);
                }
            } catch (IOException | RuntimeException e) {
                hangup(connectionId, callId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        } else if ("call.speak.ended".equals(event)) {
            hangup(connectionId, callId);
        }
    }

    private void answerForMessage(String connectionId, InboundWhatsAppCall c) {
        try {
            int status = client.answer(apiKeys.apply(connectionId), c.callControlId(), encode(BYE + c.id()),
                    c.id() + ":bye").statusCode();
            if (!ok(status)) hangup(connectionId, c.callControlId());
        } catch (IOException | RuntimeException e) {
            LOG.warnf("Could not answer WhatsApp call %s for its message: %s", c.id(), e.getMessage());
            hangup(connectionId, c.callControlId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void hangup(String connectionId, String callId) {
        if (callId == null || callId.isBlank()) return;
        try {
            int status = client.hangup(apiKeys.apply(connectionId), callId).statusCode();
            // 422: the call already ended. Other failures must retain the webhook/sweep retry.
            if (!ok(status) && status != 422) {
                throw new IllegalStateException("Telnyx hangup needs a retry: HTTP " + status);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Telnyx hangup needs a retry", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Telnyx hangup was interrupted", e);
        }
    }

    @FunctionalInterface
    private interface Call {
        HttpResponse<String> send() throws IOException, InterruptedException;
    }

    private static HttpResponse<String> require(Call call, String what) {
        try {
            HttpResponse<String> response = call.send();
            if (!ok(response.statusCode())) {
                throw new IllegalStateException("Telnyx could not " + what + ": HTTP " + response.statusCode());
            }
            return response;
        } catch (IOException e) {
            throw new IllegalStateException("Telnyx could not " + what + "; the webhook retry repeats it", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while asking Telnyx to " + what, e);
        }
    }

    private String callControlId(String body) {
        try {
            String id = json.readTree(body == null ? "{}" : body).path("data").path("call_control_id").asText("");
            return id.isBlank() ? null : id;
        } catch (IOException e) {
            return null;
        }
    }

    /** {@code +56911112222}, {@code sip:+56911112222@host} or {@code 56911112222}: E.164, or null. */
    static String callerE164(String from) {
        if (from == null) return null;
        String user = from.trim();
        if (user.startsWith("sip:") || user.startsWith("sips:")) user = user.substring(user.indexOf(':') + 1);
        int at = user.indexOf('@');
        if (at >= 0) user = user.substring(0, at);
        String digits = user.replaceAll("\\D", "");
        return digits.length() >= 8 && digits.length() <= 15 ? PhoneNumbers.e164("+" + digits) : null;
    }

    private static boolean ok(int status) {
        return status >= 200 && status < 300;
    }

    static String encode(String state) {
        return Base64.getEncoder().encodeToString(state.getBytes(StandardCharsets.UTF_8));
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }
}
