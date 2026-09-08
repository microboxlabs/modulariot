package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/**
 * Guards the repository's static SQL without a database (mirrors
 * {@code InteractionEpisodeSqlIntegrityTest}). These are the clauses a chat
 * transcript's privacy rests on, and none of them is exercised by a unit test
 * of the service, which talks to a fake repository.
 */
class HarnessThreadSqlIntegrityTest {

    @Test
    void upsertRefusesToTakeOverAnotherOwnersThread() throws Exception {
        String sql = readStaticString("UPSERT_THREAD");
        assertTrue(sql.contains("ON CONFLICT (id) DO UPDATE"),
                "creating a thread must be idempotent — the client mints the id and may retry");
        assertTrue(sql.contains("harness_thread.owner_id = EXCLUDED.owner_id"),
                "the conflict update must be guarded by the owner");
        assertTrue(sql.contains("harness_thread.tenant_code = EXCLUDED.tenant_code"),
                "the conflict update must be guarded by the tenant");
    }

    @Test
    void listingsScopeToTenantAndHideExpiredThreads() throws Exception {
        String owned = readStaticString("LIST_OWNED");
        assertTrue(owned.contains("tenant_code = $1") && owned.contains("owner_id = $2"),
                "owned listing must scope to tenant + owner");
        assertTrue(owned.contains("deleted_at IS NULL"),
                "owned listing must hide deleted threads");
        assertTrue(owned.contains("expires_at IS NULL OR expires_at > now()"),
                "owned listing must hide expired threads");

        String shared = readStaticString("LIST_SHARED_WITH");
        assertTrue(shared.contains("s.principal = $2"),
                "shared listing must match the caller as the share principal");
        assertTrue(shared.contains("t.tenant_code = $1"),
                "shared listing must scope to the tenant");
        assertTrue(shared.contains("t.expires_at IS NULL OR t.expires_at > now()"),
                "shared listing must hide expired threads");
    }

    @Test
    void findScopesToTenantAndSkipsGoneThreads() throws Exception {
        String sql = readStaticString("FIND_THREAD");
        assertTrue(sql.contains("id = $1") && sql.contains("tenant_code = $2"),
                "a thread is only reachable inside its own tenant");
        assertTrue(sql.contains("deleted_at IS NULL"),
                "a deleted thread must not be reachable by id");
    }

    @Test
    void mutationsAreOwnerScoped() throws Exception {
        assertTrue(readStaticString("UPDATE_THREAD").contains("owner_id = $2"),
                "only the owner may rename a thread or change its expiry");
        String delete = readStaticString("SOFT_DELETE_THREAD");
        assertTrue(delete.contains("owner_id = $3") && delete.contains("tenant_code = $2"),
                "only the owner may delete a thread");
        assertTrue(delete.contains("deleted_at = now()"),
                "delete is soft — the purge job collects the row later");
    }

    @Test
    void messagesUpsertAndReplayInAppendOrder() throws Exception {
        String upsert = readStaticString("UPSERT_MESSAGE");
        assertTrue(upsert.contains("ON CONFLICT (thread_id, id) DO UPDATE"),
                "a message may be rewritten in place, keyed by its client id");
        String list = readStaticString("LIST_MESSAGES");
        assertTrue(list.contains("ORDER BY seq ASC"),
                "replay must follow append order, not created_at (same-millisecond writes)");
    }

    @Test
    void purgeCollectsExpiredAndLongDeletedThreads() throws Exception {
        String sql = readStaticString("PURGE_EXPIRED");
        assertTrue(sql.contains("expires_at IS NOT NULL AND expires_at <= now()"),
                "purge must collect expired threads");
        assertTrue(sql.contains("deleted_at IS NOT NULL AND deleted_at <= $1"),
                "purge must collect deleted threads past the grace cutoff");
    }

    private static String readStaticString(String name) throws Exception {
        Field field = HarnessThreadRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
