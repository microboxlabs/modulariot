package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/** Guards the repository's static SQL without a database. */
class HarnessConversationSqlIntegrityTest {

    @Test
    void aSaveCannotReplaceAnotherTenantsMemory() throws Exception {
        String sql = readStaticString("UPSERT");
        assertTrue(sql.contains("ON CONFLICT (conversation_key) DO UPDATE"), "saving is idempotent per key");
        assertTrue(sql.contains("harness_conversation.tenant_id = EXCLUDED.tenant_id"),
                "the conflict update must be guarded by the tenant");
        assertTrue(sql.contains("harness_conversation.user_id IS NOT DISTINCT FROM EXCLUDED.user_id"),
                "and by the user");
        assertTrue(sql.contains("harness_conversation.conversation_id = EXCLUDED.conversation_id"),
                "and by the conversation");
    }

    @Test
    void aLoadReadsOneKeyOfOneTenant() throws Exception {
        assertTrue(readStaticString("FIND").contains("WHERE conversation_key = $1 AND tenant_id = $2"),
                "a load is scoped by the tenant as well as the key");
    }

    private static String readStaticString(String name) throws Exception {
        Field field = HarnessConversationRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
