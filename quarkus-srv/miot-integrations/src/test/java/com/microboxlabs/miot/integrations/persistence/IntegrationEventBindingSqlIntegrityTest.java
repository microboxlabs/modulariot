package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Guards the SQL text itself. These statements are assembled from text blocks, which strip
 * trailing spaces from every line — so a keyword left at the end of a block silently fuses
 * with whatever is concatenated after it ({@code RETURNING} + the column list becomes
 * {@code RETURNINGid}). That has reached production once already.
 */
class IntegrationEventBindingSqlIntegrityTest {

    private static List<String> statements() {
        List<String> sql = new ArrayList<>();
        for (Field field : IntegrationEventBindingRepository.class.getDeclaredFields()) {
            if (field.getType() == String.class && java.lang.reflect.Modifier.isStatic(field.getModifiers())) {
                field.setAccessible(true);
                try {
                    Object value = field.get(null);
                    if (value != null) {
                        sql.add((String) value);
                    }
                } catch (IllegalAccessException e) {
                    throw new AssertionError(e);
                }
            }
        }
        return sql;
    }

    @Test
    void noKeywordIsGluedToTheClauseItPrecedes() {
        for (String sql : statements()) {
            for (String keyword : List.of("RETURNING", "SELECT", "IN", "FROM", "WHERE", "AND")) {
                assertFalse(sql.matches("(?s).*\\b" + keyword + "[a-z_(].*"),
                        keyword + " is glued to the next token in:\n" + sql);
            }
        }
    }

    @Test
    void everyReadIsScopedToATenant() {
        for (String sql : statements()) {
            if (sql.contains("SELECT") && sql.contains("integration_event_bindings")
                    && !sql.contains("count(*)")) {
                assertTrue(sql.contains("tenant_client_id = $1"),
                        "a read that is not tenant-scoped leaks across orgs:\n" + sql);
            }
        }
    }

    @Test
    void visibilityResolvesTheParentOrgRatherThanTrustingTheCaller() {
        String visible = statements().stream()
                .filter(sql -> sql.contains("owner_org_slug IN"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no parent-inclusive read found"));

        assertTrue(visible.contains("miot_core.organizations"),
                "the parent must be resolved from the org table:\n" + visible);
        assertTrue(visible.contains("parent_id"), visible);
    }

    @Test
    void theUpsertConflictTargetMatchesTheUniqueIndex() {
        String upsert = statements().stream()
                .filter(sql -> sql.contains("ON CONFLICT"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no upsert found"));

        // The index keys on COALESCE(scope_*, ''), because NULL <> NULL would otherwise let
        // duplicate "every scope" bindings through. The conflict target has to agree exactly
        // or the upsert raises "no unique or exclusion constraint matching".
        assertTrue(upsert.contains("COALESCE(scope_kind, '')"), upsert);
        assertTrue(upsert.contains("COALESCE(scope_key, '')"), upsert);
        assertTrue(upsert.contains("connection_id"), upsert);
        assertTrue(upsert.contains("WHERE active"), "the index is partial; so must the target be:\n" + upsert);
    }

    @Test
    void deletesAreSoftSoTheAuditTrailSurvives() {
        for (String sql : statements()) {
            assertFalse(sql.contains("DELETE FROM"), "bindings are deactivated, not deleted:\n" + sql);
        }
    }
}
