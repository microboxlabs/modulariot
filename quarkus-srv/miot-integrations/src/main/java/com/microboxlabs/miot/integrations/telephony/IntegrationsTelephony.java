package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.telephony.InboundCall;
import com.microboxlabs.miot.core.telephony.WhatsAppCallPermissions;
import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Consumer;

/**
 * {@link Telephony} from the organization's TELNYX and TEAMS_PHONE connections. An organization without its own
 * TELNYX connection uses the platform's (the managed line), charged per minute. Teams Phone is only the
 * organization's own.
 *
 * <p>Each token holds a channel of its line until the call ends or {@link #HOLD} passes, and is refused when
 * {@code metadata.channelLimit} channels (default {@link #DEFAULT_CHANNELS}) are busy. On the managed line it is
 * also refused when the enforced plan says the organization used its minutes.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class IntegrationsTelephony implements Telephony {

    static final int DEFAULT_CHANNELS = 10;
    static final Duration HOLD = Duration.ofHours(2);

    private final BiFunction<String, ProviderType, IntegrationConnection> connections;
    private final TelnyxWebRtcTokens telnyx;
    private final TeamsCallRecords teams;
    private final TelephonyUsageStore usage;
    private final TelephonyPlanService plan;
    private final Clock clock;
    private final WhatsAppCalls whatsApp;
    private final WhatsAppCallPermissions permissions;

    @Inject
    public IntegrationsTelephony(IntegrationConnectionRepository repository, TelnyxWebRtcTokens telnyx,
            TeamsCallRecords teams, TelephonyUsageStore usage, TelephonyPlanService plan, WhatsAppCalls whatsApp,
            WhatsAppCallPermissions permissions) {
        this(repository::findActiveByProvider, telnyx, teams, usage, plan, Clock.systemUTC(), whatsApp, permissions);
    }

    /** {@code connections}: the tenant's connection of a provider, or null. No WhatsApp calling. */
    public IntegrationsTelephony(BiFunction<String, ProviderType, IntegrationConnection> connections,
            TelnyxWebRtcTokens telnyx, TeamsCallRecords teams, TelephonyUsageStore usage, TelephonyPlanService plan,
            Clock clock) {
        this(connections, telnyx, teams, usage, plan, clock, null, null);
    }

    public IntegrationsTelephony(BiFunction<String, ProviderType, IntegrationConnection> connections,
            TelnyxWebRtcTokens telnyx, TeamsCallRecords teams, TelephonyUsageStore usage, TelephonyPlanService plan,
            Clock clock, WhatsAppCalls whatsApp, WhatsAppCallPermissions permissions) {
        this.connections = connections;
        this.telnyx = telnyx;
        this.teams = teams;
        this.usage = usage;
        this.plan = plan;
        this.clock = clock;
        this.whatsApp = whatsApp;
        this.permissions = permissions;
    }

    @Override
    public List<TelephonyLine> lines(String tenantCode) {
        List<TelephonyLine> lines = new ArrayList<>();
        IntegrationConnection own = connections.apply(tenantCode, ProviderType.TELNYX);
        if (own != null) {
            lines.add(line(own, TelephonyProvider.TELNYX, false));
        } else if (!PlatformScope.TENANT.equals(tenantCode)) {
            IntegrationConnection managed = connections.apply(PlatformScope.TENANT, ProviderType.TELNYX);
            if (managed != null) {
                lines.add(line(managed, TelephonyProvider.TELNYX, true));
            }
        }
        IntegrationConnection teamsLine = connections.apply(tenantCode, ProviderType.TEAMS_PHONE);
        if (teamsLine != null) {
            lines.add(line(teamsLine, TelephonyProvider.TEAMS_PHONE, false));
        }
        return List.copyOf(lines);
    }

    @Override
    public WebRtcToken webRtcToken(String tenantCode, String connectionId, String operator, String calleeNumber,
            String caseRef) {
        TelephonyLine line = telnyxLine(tenantCode, connectionId);
        String callee = PhoneNumbers.e164(calleeNumber);
        if (callee == null) throw new IllegalArgumentException("An E.164 callee is required");
        return reserve(tenantCode, line, operator, callee, caseRef, UsageRow.VOICE,
                TelephonyPlanService.destinationType(callee), ref -> { }, ref -> { });
    }

    /** WhatsApp calls go through the platform's Telnyx account, so only the managed line reaches them. */
    @Override
    public boolean whatsAppCalling(String tenantCode) {
        return whatsApp != null && whatsApp.enabled() && lines(tenantCode).stream()
                .anyMatch(l -> l.provider() == TelephonyProvider.TELNYX && l.managed() && l.ready());
    }

    @Override
    public WebRtcToken whatsAppCall(String tenantCode, String connectionId, String operator, String calleeNumber,
            String caseRef) {
        TelephonyLine line = whatsAppLine(tenantCode, connectionId);
        String callee = PhoneNumbers.e164(calleeNumber);
        if (callee == null) throw new IllegalArgumentException("An E.164 callee is required");
        Optional<Boolean> allowed = permissions == null ? Optional.empty() : permissions.allows(tenantCode, callee);
        if (allowed.isPresent() && !allowed.get()) {
            throw new TelephonyUnavailableException(TelephonyUnavailableException.WHATSAPP_NO_PERMISSION,
                    "The contact has not allowed WhatsApp calls");
        }
        return reserve(tenantCode, line, operator, callee, caseRef, UsageRow.WHATSAPP_CALL, UsageRow.WHATSAPP_CALL,
                ref -> { }, ref -> { });
    }

    @Override
    public List<InboundCall> ringingWhatsAppCalls(String tenantCode) {
        if (!whatsAppCalling(tenantCode)) return List.of();
        return whatsApp.ringing(tenantCode).stream()
                .map(c -> new InboundCall(c.id(), c.callerNumber(), c.callerName(), c.caseRef(), c.createdAt()))
                .toList();
    }

    @Override
    public WebRtcToken answerWhatsAppCall(String tenantCode, String connectionId, String operator,
            String inboundCallId) {
        TelephonyLine line = whatsAppLine(tenantCode, connectionId);
        InboundWhatsAppCall call = whatsApp.inbound(inboundCallId)
                .filter(c -> tenantCode.equals(c.tenantCode()) && c.connectionId().equals(connectionId))
                .orElseThrow(() -> new TelephonyUnavailableException(TelephonyUnavailableException.WHATSAPP_CALL_TAKEN,
                        "The WhatsApp call is no longer ringing"));
        return reserve(tenantCode, line, operator, call.callerNumber(), call.caseRef(), UsageRow.WHATSAPP_CALL,
                UsageRow.WHATSAPP_INBOUND, ref -> whatsApp.claim(tenantCode, inboundCallId, ref), whatsApp::unclaim);
    }

    @Override
    public Optional<String> callFailure(String tenantCode, String callRef) {
        if (whatsApp == null) return Optional.empty();
        return usage.find(callRef).filter(r -> r.tenantCode().equals(tenantCode))
                .flatMap(r -> whatsApp.failure(r.id()));
    }

    private TelephonyLine telnyxLine(String tenantCode, String connectionId) {
        return lines(tenantCode).stream()
                .filter(l -> l.provider() == TelephonyProvider.TELNYX && l.connectionId().equals(connectionId))
                .findFirst()
                .orElseThrow(() -> new TelephonyUnavailableException("The organization has no Telnyx line"));
    }

    private TelephonyLine whatsAppLine(String tenantCode, String connectionId) {
        TelephonyLine line = telnyxLine(tenantCode, connectionId);
        if (whatsApp == null || !whatsApp.enabled() || !line.managed()) {
            throw new TelephonyUnavailableException(TelephonyUnavailableException.WHATSAPP_UNAVAILABLE,
                    "WhatsApp calling is not configured for this line");
        }
        return line;
    }

    /**
     * Holds a channel of the line with a STARTED row and issues the operator's login. {@code claim} runs under the
     * line's lock after the row is written; {@code release} undoes it when the login fails.
     */
    private WebRtcToken reserve(String tenantCode, TelephonyLine line, String operator, String callee,
            String caseRef, String channel, String destinationType, Consumer<String> claim,
            Consumer<String> release) {
        String connectionId = line.connectionId();
        String connectionTenant = line.managed() ? PlatformScope.TENANT : tenantCode;
        Instant now = clock.instant();
        IntegrationConnection connection = connections.apply(connectionTenant, ProviderType.TELNYX);
        String ref = UUID.randomUUID().toString();
        usage.locked(connectionId, () -> {
            if (line.managed()) plan.requireMinutes(tenantCode);
            int limit = channelLimit(connection);
            if (usage.busyChannels(connectionId, now.minus(HOLD)) >= limit) {
                throw new TelephonyUnavailableException(TelephonyUnavailableException.CHANNELS_BUSY,
                        "All " + limit + " channels of the line are in a call; try again in a moment");
            }
            usage.insert(new UsageRow(ref, tenantCode, channel, line.managed(), connectionId, null, caseRef,
                    callee, destinationType, UsageRow.STARTED, null, null, null, null,
                    null, null, now, null, null));
            try {
                claim.accept(ref);
            } catch (RuntimeException refused) {
                usage.update(usage.find(ref).orElseThrow().retired());
                throw refused;
            }
            return true;
        });
        TelnyxWebRtcTokens.Issued issued;
        try {
            issued = telnyx.issueFor(connectionTenant, connectionId, tenantCode, operator);
            String sipConnection = metadata(connection, TelephonyKeys.SIP_CONNECTION_ID);
            if (line.managed() && (issued.sipUsername() == null || sipConnection == null)) {
                throw new TelephonyUnavailableException("The managed SIP login cannot be attributed");
            }
            if (issued.sipUsername() != null) {
                usage.saveCredential(issued.sipUsername(), tenantCode, issued.credentialId(), sipConnection);
                if (line.managed() && !usage.tenantOfSip(issued.sipUsername(), sipConnection).orElse("").equals(tenantCode)) {
                    throw new TelephonyUnavailableException("The SIP login belongs to another organization");
                }
            }
        } catch (RuntimeException failure) {
            usage.locked(connectionId, () -> {
                UsageRow row = usage.find(ref).orElseThrow();
                if (UsageRow.STARTED.equals(row.status())) usage.update(row.retired());
                release.accept(ref);
                return true;
            });
            throw failure;
        }
        WebRtcToken token = issued.token();
        return new WebRtcToken(token.token(), token.callerNumber(), token.expiresAt(), ref);
    }

    @Override
    public void callEnded(String tenantCode, String callRef, String providerCallId) {
        UsageRow initial = usage.find(callRef).orElse(null);
        if (initial == null || !initial.tenantCode().equals(tenantCode)) return;
        usage.locked(initial.connectionId(), () -> {
            UsageRow r = usage.find(callRef).orElseThrow();
            if (!UsageRow.STARTED.equals(r.status())) return false;
            if (usage.admission(callRef).isPresent()) return false;
            // The browser only releases the reservation. Provider identifiers come from verified deliveries.
            usage.update(new UsageRow(r.id(), r.tenantCode(), r.channel(), r.managed(), r.connectionId(), r.externalId(),
                    r.caseRef(), r.calleeNumber(), r.destinationType(), UsageRow.ENDED, r.answeredAt(), r.seconds(),
                    r.billedMinutes(), r.providerCost(), r.providerCurrency(), r.source(), r.startedAt(), clock.instant(),
                    r.confirmedAt()));
            // An operator who gave up before their leg was admitted leaves the WhatsApp call ringing.
            if (whatsApp != null && UsageRow.WHATSAPP_CALL.equals(r.channel())) whatsApp.unclaim(callRef);
            return true;
        });
    }

    @Override
    public List<PstnCall> pstnCalls(String tenantCode, String connectionId, Instant from, Instant to) {
        return teams.pstnCalls(tenantCode, connectionId, from, to);
    }

    static int channelLimit(IntegrationConnection connection) {
        Object value = connection == null || connection.metadata() == null ? null
                : connection.metadata().get(TelephonyKeys.CHANNEL_LIMIT);
        try {
            int n = value == null ? DEFAULT_CHANNELS : Integer.parseInt(value.toString().trim());
            return n > 0 ? n : DEFAULT_CHANNELS;
        } catch (NumberFormatException e) {
            return DEFAULT_CHANNELS;
        }
    }

    private static String metadata(IntegrationConnection c, String key) {
        Object v = c == null || c.metadata() == null ? null : c.metadata().get(key);
        return v == null ? null : Objects.toString(v).trim();
    }

    private static TelephonyLine line(IntegrationConnection c, TelephonyProvider provider, boolean managed) {
        String key = provider == TelephonyProvider.TELNYX ? TelephonyKeys.CALLER_NUMBER
                : TelephonyKeys.DEFAULT_CALLER_ID;
        String caller = c.metadata() == null ? null : PhoneNumbers.e164(c.metadata().get(key));
        return new TelephonyLine(c.id(), provider, c.name(), caller, c.status() == ConnectionStatus.ACTIVE, managed);
    }
}
