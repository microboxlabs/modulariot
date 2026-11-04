package com.microboxlabs.miot.integrations.telephony;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Confirms the managed line's calls from Telnyx's detail records, for calls whose webhook did not arrive and to
 * add the provider's cost. A record belongs to the organization that owns its SIP login ({@code auth_username});
 * a record of an unknown login is skipped. The seconds are {@code call_sec} of an answered call, 0 otherwise.
 * Also marks STARTED rows with no news for two hours as EXPIRED, which frees their channel.
 */
@ApplicationScoped
public class TelnyxUsageReconciler {

    private static final Logger LOG = Logger.getLogger(TelnyxUsageReconciler.class);
    static final int MAX_PAGES = 20;

    public record Result(int records, int confirmed, int created, int skipped, int expired) {
    }

    private final Function<String, IntegrationConnection> managedConnection;
    private final BiFunction<String, IntegrationConnection, ResolvedConnection> resolver;
    private final TelnyxClient client;
    private final TelephonyUsageStore usage;
    private final ObjectMapper json;
    private final Clock clock;
    private final boolean enabled;

    @Inject
    public TelnyxUsageReconciler(IntegrationConnectionRepository repository, IntegrationConnectionResolver resolver,
            TelnyxClient client, TelephonyUsageStore usage, ObjectMapper json,
            @ConfigProperty(name = "miot.integrations.telephony.reconcile.enabled", defaultValue = "true")
            boolean enabled) {
        this(tenant -> repository.findActiveByProvider(tenant, ProviderType.TELNYX), resolver::resolve, client, usage,
                json, Clock.systemUTC(), enabled);
    }

    public TelnyxUsageReconciler(Function<String, IntegrationConnection> managedConnection,
            BiFunction<String, IntegrationConnection, ResolvedConnection> resolver, TelnyxClient client,
            TelephonyUsageStore usage, ObjectMapper json, Clock clock, boolean enabled) {
        this.managedConnection = managedConnection;
        this.resolver = resolver;
        this.client = client;
        this.usage = usage;
        this.json = json;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(every = "${miot.integrations.telephony.reconcile.every:15m}", delayed = "2m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Result r = run();
            if (r.records() > 0 || r.expired() > 0) {
                LOG.infof("Telnyx usage reconcile: %s", r);
            }
        } catch (RuntimeException e) {
            LOG.warnf("Telnyx usage reconcile failed: %s", e.getMessage());
        }
    }

    public Result run() {
        Instant now = clock.instant();
        int expired = usage.expireStarted(now.minus(IntegrationsTelephony.HOLD));
        IntegrationConnection connection = managedConnection.apply(PlatformScope.TENANT);
        if (connection == null || connection.status() != ConnectionStatus.ACTIVE
                || !client.serves(connection.baseUrl())) {
            return new Result(0, 0, 0, 0, expired);
        }
        ResolvedConnection resolved = resolver.apply(PlatformScope.TENANT, connection);
        String apiKey = resolved.secretString(TelephonyKeys.TOKEN);
        String sipConnectionId = resolved.metadataString(TelephonyKeys.SIP_CONNECTION_ID);
        if (apiKey == null || sipConnectionId == null) {
            return new Result(0, 0, 0, 0, expired);
        }
        int records = 0;
        int confirmed = 0;
        int created = 0;
        int skipped = 0;
        try {
            for (int page = 1; page <= MAX_PAGES; page++) {
                HttpResponse<String> response = client.detailRecords(apiKey.trim(), page);
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    LOG.warnf("Telnyx detail records returned HTTP %d", response.statusCode());
                    break;
                }
                JsonNode body = json.readTree(response.body());
                for (JsonNode cdr : body.path("data")) {
                    if (!sipConnectionId.equals(cdr.path("connection_id").asText())) {
                        continue;
                    }
                    records++;
                    switch (apply(connection.id(), cdr, now)) {
                        case CONFIRMED -> confirmed++;
                        case CREATED -> created++;
                        default -> skipped++;
                    }
                }
                if (page >= body.path("meta").path("total_pages").asInt(1)) {
                    break;
                }
            }
        } catch (IOException e) {
            LOG.warnf("Could not read Telnyx detail records: %s", e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return new Result(records, confirmed, created, skipped, expired);
    }

    enum Applied { CONFIRMED, CREATED, SKIPPED }

    Applied apply(String connectionId, JsonNode cdr, Instant now) {
        // A record without a call control id is keyed by its own id, so it is still counted once.
        String callControlId = text(cdr, "call_control_id") != null ? text(cdr, "call_control_id")
                : (text(cdr, "id") == null ? null : "cdr:" + text(cdr, "id"));
        String tenant = usage.tenantOfSip(text(cdr, "auth_username")).orElse(null);
        if (callControlId == null || tenant == null) {
            return Applied.SKIPPED;
        }
        int seconds = text(cdr, "answered_at") == null ? 0 : Math.max(0, cdr.path("call_sec").asInt(0));
        BigDecimal cost = decimal(text(cdr, "cost"));
        String currency = text(cdr, "currency");
        Instant ended = time(text(cdr, "finished_at"));
        UsageRow row = usage.findByExternal(UsageRow.VOICE, callControlId).orElse(null);
        if (row == null) {
            String callee = PhoneNumbers.e164(plus(text(cdr, "cld")));
            Instant started = time(text(cdr, "started_at"));
            UsageRow fresh = new UsageRow(UUID.randomUUID().toString(), tenant, UsageRow.VOICE, true, connectionId,
                    callControlId, null, callee, TelephonyPlanService.destinationType(callee), UsageRow.ENDED,
                    time(text(cdr, "answered_at")), null, null, null, null, null, started == null ? now : started,
                    ended, null);
            usage.insert(fresh.confirmed(seconds, cost, currency, UsageRow.SOURCE_DETAIL_RECORD, ended, now));
            return Applied.CREATED;
        }
        if (UsageRow.SOURCE_DETAIL_RECORD.equals(row.source())) {
            return Applied.SKIPPED;
        }
        if (!row.tenantCode().equals(tenant)) {
            LOG.warnf("Telnyx call %s: the SIP login's organization differs from the ledger's; using the login's",
                    row.id());
            row = new UsageRow(row.id(), tenant, row.channel(), row.managed(), row.connectionId(), row.externalId(),
                    row.caseRef(), row.calleeNumber(), row.destinationType(), row.status(), row.answeredAt(),
                    row.seconds(), row.billedMinutes(), row.providerCost(), row.providerCurrency(), row.source(),
                    row.startedAt(), row.endedAt(), row.confirmedAt());
        }
        usage.update(row.confirmed(seconds, cost, currency, UsageRow.SOURCE_DETAIL_RECORD, ended, now));
        return Applied.CONFIRMED;
    }

    private static String plus(String number) {
        return number == null || number.startsWith("+") ? number : "+" + number;
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }

    private static BigDecimal decimal(String value) {
        try {
            return value == null ? null : new BigDecimal(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Instant time(String value) {
        try {
            return value == null ? null : Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
