package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/**
 * Guards the repository's static SQL text without a database (mirrors
 * {@code InteractionEpisodeSqlIntegrityTest}): the writes target the candidates
 * table, RETURN the persisted row, and — crucially — the review transition is
 * tenant-scoped and only fires on a still-pending row (idempotent approve/reject).
 */
class KnowledgeCandidateSqlIntegrityTest {

    @Test
    void insertTargetsTheCandidatesTableAndReturnsColumns() throws Exception {
        String insert = readStaticString("INSERT");
        assertTrue(insert.contains("miot_integrations.knowledge_candidates"),
                "INSERT must target the knowledge_candidates table");
        assertTrue(insert.contains("RETURNING"),
                "INSERT must RETURN the persisted row (id + created_at)");
    }

    @Test
    void listIsTenantAndStatusScoped() throws Exception {
        String list = readStaticString("LIST_BY_STATUS");
        assertTrue(list.contains("tenant_code = $1"), "list must scope by tenant");
        assertTrue(list.contains("status = $2"), "list must filter by status");
    }

    @Test
    void updateIsTenantScopedAndPendingOnly() throws Exception {
        String update = readStaticString("UPDATE_STATUS");
        assertTrue(update.contains("tenant_code = $2"),
                "review must be tenant-scoped (no cross-tenant approval)");
        assertTrue(update.contains("status = 'pending'"),
                "review must only fire on a pending row (idempotent approve/reject)");
        assertTrue(update.contains("RETURNING"),
                "review must RETURN the updated row so the caller can 404 on null");
    }

    private static String readStaticString(String name) throws Exception {
        Field field = KnowledgeCandidateRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
