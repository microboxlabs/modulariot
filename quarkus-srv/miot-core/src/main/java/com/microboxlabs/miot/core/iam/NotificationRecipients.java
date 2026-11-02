package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Active human administrators for operational notifications. Blocking, for background workers. */
@ApplicationScoped
public class NotificationRecipients {

    public record OrganizationAudience(long id, String slug, String name, String tenantCode, List<String> emails) {
    }

    private final Instance<Pool> pools;
    private final PlatformAuthorizer authorizer;

    @Inject
    public NotificationRecipients(Instance<Pool> pools, PlatformAuthorizer authorizer) {
        this.pools = pools;
        this.authorizer = authorizer;
    }

    public List<String> platformOwners() {
        var rows = execute("""
                SELECT DISTINCT lower(trim(c.email)) AS email FROM (
                    SELECT person_id AS email FROM miot_core.platform_role_assignments WHERE role_code = 'PLATFORM_OWNER'
                    UNION SELECT unnest($1::text[])
                ) c LEFT JOIN miot_iam.iam_user u ON lower(u.email) = lower(trim(c.email))
                WHERE position('@' IN c.email) > 1 AND (u.id IS NULL OR u.status = 'ACTIVE')
                ORDER BY 1""", Tuple.of(authorizer.bootstrapOwners().toArray(String[]::new)));
        List<String> out = new ArrayList<>();
        rows.forEach(row -> out.add(row.getString("email")));
        return List.copyOf(out);
    }

    public OrganizationAudience organizationAdmins(String slug) {
        var rows = execute("""
                SELECT o.id, o.slug, coalesce(o.display_name, o.name) AS name, o.tenant_client_id,
                       array_agg(DISTINCT lower(u.email)) FILTER (WHERE u.id IS NOT NULL) AS emails
                  FROM miot_core.organizations o
                  LEFT JOIN miot_iam.iam_membership m ON m.organization_id = o.id
                       AND m.status = 'ACTIVE' AND m.base_role IN ('OWNER', 'ADMIN')
                  LEFT JOIN miot_iam.iam_user u ON u.id = m.user_id AND u.status = 'ACTIVE'
                 WHERE o.slug = $1 AND o.active AND o.parent_id IS NULL
                 GROUP BY o.id""", Tuple.of(slug));
        if (!rows.iterator().hasNext()) {
            throw new IllegalArgumentException("No active organization for geocoding notification");
        }
        Row row = rows.iterator().next();
        String[] emails = row.getArrayOfStrings("emails");
        return new OrganizationAudience(row.getLong("id"), row.getString("slug"), row.getString("name"),
                row.getString("tenant_client_id"), emails == null ? List.of() : List.of(emails));
    }

    protected RowSet<Row> execute(String sql, Tuple params) {
        return pools.get().preparedQuery(sql).execute(params).await().atMost(Duration.ofSeconds(10));
    }
}
