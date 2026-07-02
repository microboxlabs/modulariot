package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/**
 * Guards the async-job CLAIM query against the ambiguous-{@code id} regression.
 *
 * <p>The claim is an {@code UPDATE ... async_jobs a FROM runnable r}: because the
 * {@code runnable} CTE and the target table both expose an {@code id}, a bare
 * {@code id} in the join / {@code RETURNING} resolves to two relations and
 * PostgreSQL raises {@code 42702 column reference "id" is ambiguous}. The CTE
 * must therefore project its key under a distinct name ({@code job_id}). This is
 * a query-analysis error that fires even with zero matching rows, yet never
 * surfaces in stubbed unit tests — only against a real database.
 */
class AsyncJobSqlIntegrityTest {

    @Test
    void claimJoinsOnDistinctlyNamedKeyToAvoidAmbiguousId() throws Exception {
        String claim = readStaticString("CLAIM");
        assertTrue(
                claim.contains("AS job_id"),
                "CLAIM's runnable CTE must alias its key as job_id so RETURNING id is unambiguous:\n" + claim);
        assertTrue(
                claim.contains("r.job_id"),
                "CLAIM must join the target table on r.job_id:\n" + claim);
        assertFalse(
                claim.contains("r.id"),
                "CLAIM must not reference r.id — it is ambiguous with the target table's id:\n" + claim);
    }

    private static String readStaticString(String name) throws Exception {
        Field field = AsyncJobRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
