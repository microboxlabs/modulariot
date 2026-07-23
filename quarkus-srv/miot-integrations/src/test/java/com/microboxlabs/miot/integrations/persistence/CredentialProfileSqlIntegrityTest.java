package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Query-shape guards for credential SQL. These are the mistakes that unit tests with
 * stubbed repositories cannot catch and that only a real database would surface — by
 * which point the damage (a cross-tenant read, a secret rotated by accident) is done.
 */
class CredentialProfileSqlIntegrityTest {

    private static final List<String> TENANT_SCOPED = List.of(
            "SELECT_BY_TENANT", "SELECT_BY_ID", "UPDATE_SECRET",
            "UPDATE_PROFILE", "UPDATE_TEST_RESULT", "SOFT_DELETE");

    @Test
    void everyReadAndWriteIsScopedByTenant() throws Exception {
        for (String name : TENANT_SCOPED) {
            String sql = readStaticString(name);
            assertTrue(
                    sql.contains("tenant_code = $1"),
                    name + " must be scoped by tenant_code so one org cannot reach another's credentials:\n" + sql);
        }
    }

    @Test
    void everyReadAndWriteExcludesSoftDeletedRows() throws Exception {
        for (String name : TENANT_SCOPED) {
            String sql = readStaticString(name);
            assertTrue(
                    sql.contains("active"),
                    name + " must filter on active, or a deleted credential stays reachable:\n" + sql);
        }
    }

    /**
     * The partial update binds NULL for every field the caller left alone. Without an
     * explicit cast PostgreSQL cannot infer the parameter's type and rejects the
     * statement — with zero rows involved, so no stubbed test would notice.
     */
    @Test
    void partialUpdateCastsItsNullableBinds() throws Exception {
        String sql = readStaticString("UPDATE_PROFILE");
        for (String cast : List.of("$3::text", "$4::text", "$5::jsonb", "$6::text", "$7::text", "$8::text")) {
            assertTrue(sql.contains(cast), "UPDATE_PROFILE must cast " + cast + ":\n" + sql);
        }
    }

    /**
     * A blank secret on the edit form means "keep the stored one". If the update bumped
     * secret_version regardless, every save would look like a rotation and any cache
     * keyed on that version would be thrown away for nothing.
     */
    @Test
    void partialUpdateRotatesTheSecretOnlyWhenOneIsSupplied() throws Exception {
        String sql = readStaticString("UPDATE_PROFILE");
        assertTrue(
                sql.contains("secret_version = CASE WHEN $6::text IS NULL THEN secret_version ELSE secret_version + 1 END"),
                "UPDATE_PROFILE must leave secret_version alone when no new ciphertext is bound:\n" + sql);
        assertTrue(
                sql.contains("encrypted_secret_json = COALESCE($6::text, encrypted_secret_json)"),
                "UPDATE_PROFILE must keep the stored ciphertext when none is bound:\n" + sql);
    }

    /** Recording a test result is not an edit — see the comment on the query itself. */
    @Test
    void recordingATestResultDoesNotTouchUpdatedAt() throws Exception {
        String sql = readStaticString("UPDATE_TEST_RESULT");
        // The column is still selected back, so it is the assignment that must be absent.
        assertFalse(
                sql.contains("updated_at ="),
                "UPDATE_TEST_RESULT must not move updated_at, or testing reshuffles a list sorted by it:\n" + sql);
    }

    private String readStaticString(String fieldName) throws Exception {
        Field field = CredentialProfileRepository.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
