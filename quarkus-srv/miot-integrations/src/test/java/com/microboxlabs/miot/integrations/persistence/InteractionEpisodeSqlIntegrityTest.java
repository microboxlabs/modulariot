package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/**
 * Guards the repository's static SQL text without a database (mirrors
 * {@code AsyncJobSqlIntegrityTest}): the INSERT must target the episodes table
 * and RETURN the persisted row so callers get the DB-assigned id + created_at.
 */
class InteractionEpisodeSqlIntegrityTest {

    @Test
    void insertTargetsTheEpisodesTableAndReturnsColumns() throws Exception {
        String insert = readStaticString("INSERT");
        assertTrue(insert.contains("miot_integrations.interaction_episodes"),
                "INSERT must target the interaction_episodes table");
        assertTrue(insert.contains("RETURNING"),
                "INSERT must RETURN the persisted row (id + created_at)");
    }

    @Test
    void listRecentByTenantScopesToTenantAndBounds() throws Exception {
        String sql = readStaticString("LIST_RECENT_BY_TENANT");
        assertTrue(sql.contains("miot_integrations.interaction_episodes"),
                "read must target the interaction_episodes table");
        assertTrue(sql.contains("tenant_code = $1"),
                "read must scope to the tenant (no cross-tenant leak)");
        assertTrue(sql.contains("created_at >= $2") && sql.contains("LIMIT $3"),
                "read must be bounded by a since-cutoff and a limit");
        assertTrue(sql.contains("ORDER BY created_at DESC"),
                "read must return newest episodes first");
    }

    @Test
    void listDistinctTenantsIsBoundedAndTenantOnly() throws Exception {
        String sql = readStaticString("LIST_DISTINCT_RECENT_TENANTS");
        assertTrue(sql.contains("DISTINCT tenant_code"),
                "the per-tenant loop driver selects distinct tenant_code");
        assertTrue(sql.contains("created_at >= $1"),
                "must only surface tenants with recent activity");
    }

    private static String readStaticString(String name) throws Exception {
        Field field = InteractionEpisodeRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
