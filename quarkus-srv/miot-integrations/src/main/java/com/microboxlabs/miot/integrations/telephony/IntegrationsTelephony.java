package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.core.auth.PlatformScope;
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
import java.util.UUID;
import java.util.function.BiFunction;

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

    @Inject
    public IntegrationsTelephony(IntegrationConnectionRepository repository, TelnyxWebRtcTokens telnyx,
            TeamsCallRecords teams, TelephonyUsageStore usage, TelephonyPlanService plan) {
        this(repository::findActiveByProvider, telnyx, teams, usage, plan, Clock.systemUTC());
    }

    /** {@code connections}: the tenant's connection of a provider, or null. */
    public IntegrationsTelephony(BiFunction<String, ProviderType, IntegrationConnection> connections,
            TelnyxWebRtcTokens telnyx, TeamsCallRecords teams, TelephonyUsageStore usage, TelephonyPlanService plan,
            Clock clock) {
        this.connections = connections;
        this.telnyx = telnyx;
        this.teams = teams;
        this.usage = usage;
        this.plan = plan;
        this.clock = clock;
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
        TelephonyLine line = lines(tenantCode).stream()
                .filter(l -> l.provider() == TelephonyProvider.TELNYX && l.connectionId().equals(connectionId))
                .findFirst()
                .orElseThrow(() -> new TelephonyUnavailableException("The organization has no Telnyx line"));
        String connectionTenant = line.managed() ? PlatformScope.TENANT : tenantCode;
        String callee = PhoneNumbers.e164(calleeNumber);
        if (callee == null) throw new IllegalArgumentException("An E.164 callee is required");
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
            usage.insert(new UsageRow(ref, tenantCode, UsageRow.VOICE, line.managed(), connectionId, null, caseRef,
                    callee, TelephonyPlanService.destinationType(callee), UsageRow.STARTED, null, null, null, null,
                    null, null, now, null, null));
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
            // The browser only releases the reservation. Provider identifiers come from verified deliveries.
            usage.update(new UsageRow(r.id(), r.tenantCode(), r.channel(), r.managed(), r.connectionId(), r.externalId(),
                    r.caseRef(), r.calleeNumber(), r.destinationType(), UsageRow.ENDED, r.answeredAt(), r.seconds(),
                    r.billedMinutes(), r.providerCost(), r.providerCurrency(), r.source(), r.startedAt(), clock.instant(),
                    r.confirmedAt()));
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
