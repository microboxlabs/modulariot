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
import com.microboxlabs.miot.integrations.telephony.TelephonyUsageStore.ReconcileCursor;
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

    public record Result(int records, int confirmed, int created, int skipped, int expired, boolean incomplete, int nextPage) {
        public Result(int records, int confirmed, int created, int skipped, int expired) {
            this(records, confirmed, created, skipped, expired, false, 1);
        }
    }

    private final Function<String, IntegrationConnection> managedConnection;
    private final BiFunction<String, IntegrationConnection, ResolvedConnection> resolver;
    private final TelnyxClient client;
    private final TelephonyUsageStore usage;
    private final ObjectMapper json;
    private final Clock clock;
    private final boolean enabled;
    private WhatsAppUsageRecovery whatsAppRecovery;

    @Inject
    public TelnyxUsageReconciler(IntegrationConnectionRepository repository, IntegrationConnectionResolver resolver,
            TelnyxClient client, TelephonyUsageStore usage, ObjectMapper json,
            @ConfigProperty(name = "miot.integrations.telephony.reconcile.enabled", defaultValue = "true")
            boolean enabled, WhatsAppUsageRecovery whatsAppRecovery) {
        this(tenant -> repository.findActiveByProvider(tenant, ProviderType.TELNYX), resolver::resolve, client, usage,
                json, Clock.systemUTC(), enabled);
        this.whatsAppRecovery = whatsAppRecovery;
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
            if (r.records() > 0 || r.expired() > 0 || r.incomplete()) {
                LOG.infof("Telnyx usage reconcile: %s", r);
            }
        } catch (RuntimeException e) {
            LOG.warnf("Telnyx usage reconcile failed: %s", e.getMessage());
        }
    }

    public Result run() {
        Instant now = clock.instant();
        IntegrationConnection connection = managedConnection.apply(PlatformScope.TENANT);
        if (connection == null || connection.status() != ConnectionStatus.ACTIVE
                || !client.serves(connection.baseUrl())) {
            return expiredOnly(now);
        }
        ResolvedConnection resolved = resolver.apply(PlatformScope.TENANT, connection);
        String apiKey = resolved.secretString(TelephonyKeys.TOKEN);
        String sipConnectionId = resolved.metadataString(TelephonyKeys.SIP_CONNECTION_ID);
        if (apiKey == null || sipConnectionId == null) {
            return expiredOnly(now);
        }
        return usage.locked("reconcile:" + connection.id(), () -> {
            int recovered = whatsAppRecovery == null ? 0 : whatsAppRecovery.recover(connection.id(), apiKey, now);
            int expired = usage.expireStarted(now.minus(IntegrationsTelephony.HOLD));
            Result result = scan(connection, apiKey, sipConnectionId, now, expired);
            return new Result(result.records(), result.confirmed() + recovered, result.created(), result.skipped(),
                    result.expired(), result.incomplete(), result.nextPage());
        });
    }

    private Result expiredOnly(Instant now) {
        return new Result(0, 0, 0, 0, usage.expireStarted(now.minus(IntegrationsTelephony.HOLD)));
    }

    private Result scan(IntegrationConnection connection, String apiKey, String sipConnectionId, Instant now, int expired) {
        ReconcileCursor cursor = usage.reconcileCursor(connection.id()).orElse(new ReconcileCursor(1, now));
        int nextPage = cursor.nextPage();
        boolean complete = false;
        Counts counts = new Counts(0, 0, 0, 0);
        try {
            for (int visited = 0; visited < MAX_PAGES; visited++) {
                int page = nextPage;
                JsonNode body = readPage(apiKey, page, cursor.startedAt(), now);
                if (body == null) break;
                counts = counts.plus(applyPage(connection.id(), sipConnectionId, body, now));
                if (page >= body.path("meta").path("total_pages").asInt(1)) {
                    complete = true;
                    usage.clearReconcileCursor(connection.id());
                    nextPage = 1;
                    break;
                }
                nextPage = page + 1;
                usage.saveReconcileCursor(connection.id(), new ReconcileCursor(nextPage, cursor.startedAt()));
            }
        } catch (IOException e) {
            LOG.warnf("Could not read Telnyx detail records: %s", e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (!complete) {
            usage.saveReconcileCursor(connection.id(), new ReconcileCursor(nextPage, cursor.startedAt()));
            LOG.warnf("Telnyx detail-record scan incomplete; next run resumes at page %d (scan started %s)", nextPage, cursor.startedAt());
        }
        return new Result(counts.records(), counts.confirmed(), counts.created(), counts.skipped(), expired, !complete, nextPage);
    }

    private record Counts(int records, int confirmed, int created, int skipped) {
        Counts plus(Counts other) {
            return new Counts(records + other.records, confirmed + other.confirmed, created + other.created, skipped + other.skipped);
        }
    }

    private JsonNode readPage(String apiKey, int page, Instant scanStartedAt, Instant now)
            throws IOException, InterruptedException {
        HttpResponse<String> response = client.detailRecords(apiKey.trim(), page, scanStartedAt, now);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            LOG.warnf("Telnyx detail records returned HTTP %d", response.statusCode());
            return null;
        }
        JsonNode body = json.readTree(response.body());
        if (body == null || !body.path("data").isArray() || !body.path("meta").path("total_pages").canConvertToInt()) {
            LOG.warn("Telnyx detail records omitted pagination metadata; retaining the scan cursor");
            return null;
        }
        return body;
    }

    private Counts applyPage(String connectionId, String sipConnectionId, JsonNode body, Instant now) {
        int records = 0;
        int confirmed = 0;
        int created = 0;
        int skipped = 0;
        for (JsonNode cdr : body.path("data")) {
            if (!sipConnectionId.equals(cdr.path("connection_id").asText())) continue;
            records++;
            switch (apply(connectionId, cdr, now)) {
                case CONFIRMED -> confirmed++;
                case CREATED -> created++;
                default -> skipped++;
            }
        }
        return new Counts(records, confirmed, created, skipped);
    }

    enum Applied { CONFIRMED, CREATED, SKIPPED }

    Applied apply(String connectionId, JsonNode cdr, Instant now) {
        // A record without a call control id is keyed by its own id, so it is still counted once.
        String callControlId = text(cdr, "call_control_id") != null ? text(cdr, "call_control_id")
                : (text(cdr, "id") == null ? null : "cdr:" + text(cdr, "id"));
        String tenant = usage.tenantOfSip(text(cdr, "auth_username"), text(cdr, "connection_id")).orElse(null);
        if (callControlId == null || tenant == null || whatsAppOperatorLeg(callControlId)) {
            return Applied.SKIPPED;
        }
        return usage.locked(connectionId, () -> applyLocked(connectionId, cdr, now, callControlId, tenant));
    }

    private Applied applyLocked(String connectionId, JsonNode cdr, Instant now, String callControlId, String tenant) {
        int seconds = text(cdr, "answered_at") == null ? 0 : Math.max(0, cdr.path("call_sec").asInt(0));
        BigDecimal cost = decimal(text(cdr, "cost"));
        String currency = text(cdr, "currency");
        Instant ended = time(text(cdr, "finished_at"));
        Instant started = time(text(cdr, "started_at"));
        Instant answered = time(text(cdr, "answered_at"));
        String callee = PhoneNumbers.e164(plus(text(cdr, "cld")));
        UsageRow row = usage.findByExternal(UsageRow.VOICE, callControlId).orElse(null);
        if (row == null) {
            UsageRow fresh = new UsageRow(UUID.randomUUID().toString(), tenant, UsageRow.VOICE, true, connectionId,
                    callControlId, null, callee, TelephonyPlanService.destinationType(callee), UsageRow.ENDED,
                    answered, null, null, null, null, null, started == null ? now : started, ended, null);
            usage.insert(fresh.confirmed(seconds, cost, currency, UsageRow.SOURCE_DETAIL_RECORD, ended, now));
            return Applied.CREATED;
        }
        if (!row.tenantCode().equals(tenant) || !connectionId.equals(row.connectionId())) {
            LOG.warnf("Telnyx call %s has conflicting ledger ownership; refusing to move it between tenants", row.id());
            return Applied.SKIPPED;
        }
        if (UsageRow.SOURCE_DETAIL_RECORD.equals(row.source())
                && java.util.Objects.equals(row.calleeNumber(), callee)
                && java.util.Objects.equals(row.answeredAt(), answered)
                && (started == null || started.equals(row.startedAt()))
                && java.util.Objects.equals(row.endedAt(), ended)
                && java.util.Objects.equals(row.seconds(), seconds)
                && (cost == null || (row.providerCost() != null && cost.compareTo(row.providerCost()) == 0
                        && java.util.Objects.equals(row.providerCurrency(), currency)))) return Applied.SKIPPED;
        row = row.providerData(callControlId, callee, started, answered, row.caseRef());
        usage.update(row.confirmed(seconds, cost, currency, UsageRow.SOURCE_DETAIL_RECORD, ended, now));
        return Applied.CONFIRMED;
    }

    /** A WhatsApp call's operator leg: the ledger row is the WhatsApp leg's, priced per WhatsApp minute. */
    private boolean whatsAppOperatorLeg(String callControlId) {
        return usage.admissionByParkedCall(callControlId).flatMap(a -> usage.find(a.callRef()))
                .map(r -> UsageRow.WHATSAPP_CALL.equals(r.channel())).orElse(false);
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
