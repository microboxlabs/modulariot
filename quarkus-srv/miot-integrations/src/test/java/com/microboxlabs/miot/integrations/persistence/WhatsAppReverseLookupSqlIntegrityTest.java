package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/**
 * Guards the inbound-webhook reverse-lookup query that maps a Meta {@code phone_number_id} back
 * to the owning org. The query is filter-correctness that fires even with zero matching rows but
 * is never exercised by the stubbed unit tests, so we assert its shape statically:
 *
 * <ul>
 *   <li>it must be scoped to WHATSAPP connections that are {@code active} (never route inbound to
 *       another provider or a soft-deleted connection), and</li>
 *   <li>it must filter on the JSONB {@code metadata->>'phone_number_id'} key the partial index
 *       (V0.6.3) is built on, so the lookup stays a single indexed probe.</li>
 * </ul>
 */
class WhatsAppReverseLookupSqlIntegrityTest {

    @Test
    void reverseLookupIsScopedToActiveWhatsAppConnectionsByPhoneNumberId() throws Exception {
        String sql = readStaticString("SELECT_ACTIVE_WHATSAPP_BY_PHONE_NUMBER_ID");
        assertTrue(
                sql.contains("provider_type = 'WHATSAPP'"),
                "reverse lookup must be scoped to WHATSAPP connections:\n" + sql);
        assertTrue(
                sql.contains("active"),
                "reverse lookup must exclude soft-deleted connections:\n" + sql);
        assertTrue(
                sql.contains("metadata->>'phone_number_id' = $1"),
                "reverse lookup must filter on the indexed metadata phone_number_id key:\n" + sql);
        assertFalse(
                sql.contains("tenant_code ="),
                "reverse lookup runs without a tenant (inbound has none yet) — it must not filter by one:\n" + sql);
    }

    private static String readStaticString(String name) throws Exception {
        Field field = IntegrationConnectionRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
