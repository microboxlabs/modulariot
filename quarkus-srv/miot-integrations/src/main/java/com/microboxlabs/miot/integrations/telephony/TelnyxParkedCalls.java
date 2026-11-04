package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * Consumes one reservation per parked SDK leg, then originates its PSTN leg with the server's API key.
 * Reusing a JWT creates another parked leg, which cannot consume an already-bound reservation.
 */
@ApplicationScoped
public class TelnyxParkedCalls {
    static final Duration ADMISSION_TTL = Duration.ofMinutes(5);
    private static final String TARGET = "pstn:";

    public record Handling(boolean handled, String callRef) {
    }

    private final Function<String, IntegrationConnection> connections;
    private final BiFunction<String, IntegrationConnection, ResolvedConnection> resolver;
    private final TelephonyUsageStore usage;
    private final TelephonyPlanService plan;
    private final TelnyxClient client;
    private final Clock clock;

    @Inject
    public TelnyxParkedCalls(IntegrationConnectionRepository connections, IntegrationConnectionResolver resolver,
            TelephonyUsageStore usage, TelephonyPlanService plan, TelnyxClient client) {
        this(connections::findActiveTelnyxById, resolver::resolve, usage, plan, client, Clock.systemUTC());
    }

    public TelnyxParkedCalls(Function<String, IntegrationConnection> connections,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, TelephonyUsageStore usage,
            TelephonyPlanService plan, TelnyxClient client, Clock clock) {
        this.connections = connections;
        this.resolver = resolver;
        this.usage = usage;
        this.plan = plan;
        this.client = client;
        this.clock = clock;
    }

    /** Called only after verification of the provider's webhook signature. */
    public Handling handle(String connectionId, String event, JsonNode payload) {
        String callId = payload.path("call_control_id").asText("");
        String state = TelnyxCallEvents.decode(payload.path("client_state").asText(null));
        if (state != null && state.startsWith(TARGET)) {
            return handleTarget(connectionId, event, callId, state);
        }
        CallAdmission existing = usage.admissionByParkedCall(callId).orElse(null);
        if (existing != null) return handleExisting(connectionId, event, existing);
        if (!"call.initiated".equals(event)) return new Handling(true, null);
        if ("incoming".equals(payload.path("direction").asText())) return new Handling(false, null);
        if (!"parked".equals(payload.path("state").asText()) || callId.isBlank()) {
            reject(connectionId, callId);
            return new Handling(true, null);
        }
        CallAdmission admission;
        try {
            admission = usage.locked(connectionId, () -> admit(connectionId, callId, state));
        } catch (TelephonyUnavailableException e) {
            reject(connectionId, callId);
            return new Handling(true, null);
        }
        // Commit the binding before network I/O. A timeout must not lose the private target state or
        // allow another SDK leg to spend the reservation while Telnyx is processing the transfer.
        transfer(connectionId, admission, usage.find(admission.callRef()).orElseThrow());
        return new Handling(true, null);
    }

    private Handling handleTarget(String connectionId, String event, String callId, String state) {
        CallAdmission admission = usage.admissionByTargetState(state.substring(TARGET.length())).orElse(null);
        UsageRow row = admission == null ? null : usage.find(admission.callRef()).orElse(null);
        if (row != null && connectionId.equals(row.connectionId()) && !callId.isBlank()
                && (row.externalId() == null || callId.equals(row.externalId()))) {
            return new Handling(false, row.id());
        }
        if ("call.initiated".equals(event)) reject(connectionId, callId);
        return new Handling(true, null);
    }

    private Handling handleExisting(String connectionId, String event, CallAdmission existing) {
        UsageRow row = usage.find(existing.callRef()).orElseThrow();
        if (!connectionId.equals(row.connectionId())) return new Handling(true, null);
        if ("call.hangup".equals(event)) {
            usage.locked(connectionId, () -> {
                UsageRow current = usage.find(row.id()).orElseThrow();
                if (current.externalId() == null) usage.update(current.retired());
                return true;
            });
        } else if ("call.initiated".equals(event) && UsageRow.STARTED.equals(row.status())) {
            transfer(connectionId, existing, row);
        }
        return new Handling(true, null);
    }

    private CallAdmission admit(String connectionId, String callId, String ref) {
        UsageRow row = ref == null ? null : usage.find(ref).orElse(null);
        if (row == null || !connectionId.equals(row.connectionId()) || !UsageRow.VOICE.equals(row.channel())
                || !UsageRow.STARTED.equals(row.status()) || row.externalId() != null || row.endedAt() != null
                || row.startedAt().isBefore(clock.instant().minus(ADMISSION_TTL))
                || usage.admission(ref).isPresent()) {
            throw new TelephonyUnavailableException("No unused call reservation");
        }
        IntegrationConnection connection = requireConnection(connectionId);
        if (row.managed()) plan.requireMinutes(row.tenantCode());
        if (usage.busyChannels(connectionId, clock.instant().minus(IntegrationsTelephony.HOLD))
                > IntegrationsTelephony.channelLimit(connection)) {
            throw new TelephonyUnavailableException("The line has no available channel");
        }
        CallAdmission admission = new CallAdmission(ref, callId, UUID.randomUUID().toString());
        usage.saveAdmission(admission);
        return admission;
    }

    private IntegrationConnection requireConnection(String id) {
        IntegrationConnection connection = connections.apply(id);
        if (connection == null || !client.serves(connection.baseUrl())) {
            throw new TelephonyUnavailableException("The Telnyx line is unavailable");
        }
        return connection;
    }

    private ResolvedConnection resolve(String id) {
        IntegrationConnection connection = requireConnection(id);
        return resolver.apply(connection.tenantCode(), connection);
    }

    private void transfer(String connectionId, CallAdmission admission, UsageRow row) {
        ResolvedConnection connection = resolve(connectionId);
        String targetState = Base64.getEncoder().encodeToString((TARGET + admission.targetState()).getBytes(StandardCharsets.UTF_8));
        try {
            requireSuccess(client.transfer(connection.secretString(TelephonyKeys.TOKEN), admission.parkedCallId(),
                    row.calleeNumber(), PhoneNumbers.e164(connection.metadataString(TelephonyKeys.CALLER_NUMBER)),
                    targetState, row.id(), (int) Math.max(30, Duration.between(clock.instant(),
                            row.startedAt().plus(IntegrationsTelephony.HOLD)).toSeconds() - 60)).statusCode());
        } catch (IOException e) {
            throw new IllegalStateException("The Telnyx transfer needs a webhook retry", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("The Telnyx transfer was interrupted", e);
        }
    }

    private void reject(String connectionId, String callId) {
        if (callId.isBlank()) return;
        try {
            requireSuccess(client.hangup(resolve(connectionId).secretString(TelephonyKeys.TOKEN), callId).statusCode());
        } catch (IOException e) {
            throw new IllegalStateException("The Telnyx rejection needs a webhook retry", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("The Telnyx rejection was interrupted", e);
        }
    }

    private static void requireSuccess(int status) {
        if (status < 200 || status >= 300) throw new IllegalStateException("Telnyx call control returned HTTP " + status);
    }
}
