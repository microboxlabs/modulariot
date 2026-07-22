package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.JobNotificationRule;
import io.vertx.core.json.JsonArray;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class JobNotificationRuleRepository {

    private static final String COLUMNS = """
            id, tenant_code, job_type, channel, recipients, enabled,
            throttle_seconds, template_name, language, last_notified_at,
            created_at, updated_at""";

    private static final String LIST = """
            SELECT %s
            FROM miot_integrations.job_notification_rules
            WHERE tenant_code = $1
            ORDER BY job_type, channel""".formatted(COLUMNS);

    private static final String FIND_ENABLED = """
            SELECT %s
            FROM miot_integrations.job_notification_rules
            WHERE tenant_code = $1 AND job_type = $2 AND enabled""".formatted(COLUMNS);

    private static final String UPSERT = """
            INSERT INTO miot_integrations.job_notification_rules (
                tenant_code, job_type, channel, recipients, enabled,
                throttle_seconds, template_name, language
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (tenant_code, job_type, channel) DO UPDATE
            SET recipients = EXCLUDED.recipients,
                enabled = EXCLUDED.enabled,
                throttle_seconds = EXCLUDED.throttle_seconds,
                template_name = EXCLUDED.template_name,
                language = EXCLUDED.language,
                updated_at = now()
            RETURNING %s""".formatted(COLUMNS);

    private static final String DELETE = """
            DELETE FROM miot_integrations.job_notification_rules
            WHERE tenant_code = $1 AND job_type = $2 AND channel = $3""";

    /**
     * Atomic throttle claim: stamps {@code last_notified_at} only when the rule
     * is enabled and its window has elapsed, so concurrent parks across pods
     * race for one slot and exactly one wins ({@code throttle_seconds = 0}
     * always passes). Returns the stamp so a caller whose follow-up work fails
     * can hand it back to {@link #releaseThrottleSlot}.
     */
    private static final String CLAIM_SLOT = """
            UPDATE miot_integrations.job_notification_rules
            SET last_notified_at = now(), updated_at = now()
            WHERE id = $1::uuid
              AND enabled
              AND (last_notified_at IS NULL
                   OR last_notified_at <= now() - make_interval(secs => throttle_seconds))
            RETURNING last_notified_at""";

    /**
     * Compensation for a claim whose follow-up enqueue failed: reopen the
     * window so the claim doesn't suppress notifications it never produced.
     * CAS on the exact claimed stamp — a newer claim's stamp never matches, so
     * this can only undo its own claim.
     */
    private static final String RELEASE_SLOT = """
            UPDATE miot_integrations.job_notification_rules
            SET last_notified_at = NULL, updated_at = now()
            WHERE id = $1::uuid AND last_notified_at = $2""";

    private final Instance<Pool> clientInstance;

    protected JobNotificationRuleRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<JobNotificationRule> list(String tenantCode) {
        return client().preparedQuery(LIST)
                .execute(Tuple.of(tenantCode))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public List<JobNotificationRule> findEnabled(String tenantCode, String jobType) {
        return client().preparedQuery(FIND_ENABLED)
                .execute(Tuple.of(tenantCode, jobType))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public JobNotificationRule upsert(JobNotificationRule rule) {
        Tuple params = Tuple.tuple()
                .addString(rule.tenantCode())
                .addString(rule.jobType())
                .addString(rule.channel())
                .addJsonArray(new JsonArray(rule.recipients() == null ? List.of() : rule.recipients()))
                .addBoolean(rule.enabled())
                .addInteger(rule.throttleSeconds())
                .addString(rule.templateName())
                .addString(rule.language());
        RowSet<Row> rows = client().preparedQuery(UPSERT)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    /** @return true when a rule existed and was deleted */
    public boolean delete(String tenantCode, String jobType, String channel) {
        return client().preparedQuery(DELETE)
                .execute(Tuple.of(tenantCode, jobType, channel))
                .await().indefinitely()
                .rowCount() > 0;
    }

    /**
     * @return the claimed {@code last_notified_at} stamp when this call won the
     *         rule's throttle slot, null when throttled. See {@link #CLAIM_SLOT}.
     */
    public OffsetDateTime claimThrottleSlot(String ruleId) {
        RowSet<Row> rows = client().preparedQuery(CLAIM_SLOT)
                .execute(Tuple.of(ruleId))
                .await().indefinitely();
        return rows.iterator().hasNext()
                ? rows.iterator().next().getOffsetDateTime("last_notified_at")
                : null;
    }

    /**
     * Reverts a {@link #claimThrottleSlot} whose follow-up enqueue failed.
     * @return true when the claim was still in place and got released
     */
    public boolean releaseThrottleSlot(String ruleId, OffsetDateTime claimedAt) {
        return client().preparedQuery(RELEASE_SLOT)
                .execute(Tuple.of(ruleId, claimedAt))
                .await().indefinitely()
                .rowCount() > 0;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private JobNotificationRule mapRow(Row row) {
        return new JobNotificationRule(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("job_type"),
                row.getString("channel"),
                toRecipients(row.getJsonArray("recipients")),
                Boolean.TRUE.equals(row.getBoolean("enabled")),
                row.getInteger("throttle_seconds"),
                row.getString("template_name"),
                row.getString("language"),
                row.getOffsetDateTime("last_notified_at"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }

    private List<String> toRecipients(JsonArray value) {
        if (value == null) {
            return List.of();
        }
        List<String> recipients = new ArrayList<>(value.size());
        for (int i = 0; i < value.size(); i++) {
            recipients.add(String.valueOf(value.getValue(i)));
        }
        return recipients;
    }
}
