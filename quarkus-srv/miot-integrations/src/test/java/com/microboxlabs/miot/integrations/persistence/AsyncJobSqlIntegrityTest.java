package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

    @Test
    void claimAnyTenantJoinsOnDistinctlyNamedKeyToAvoidAmbiguousId() throws Exception {
        String claim = readStaticString("CLAIM_ANY_TENANT");
        assertTrue(
                claim.contains("AS job_id"),
                "CLAIM_ANY_TENANT's runnable CTE must alias its key as job_id:\n" + claim);
        assertTrue(
                claim.contains("r.job_id"),
                "CLAIM_ANY_TENANT must join the target table on r.job_id:\n" + claim);
        assertFalse(
                claim.contains("r.id"),
                "CLAIM_ANY_TENANT must not reference r.id — it is ambiguous with the target table's id:\n" + claim);
    }

    /**
     * The console page and its "of N" must be computed from the same predicate,
     * or the total would count rows the list can never show.
     */
    @Test
    void countReusesTheListFilters() throws Exception {
        String filters = readStaticString("LIST_FILTERS");
        assertTrue(readStaticString("LIST").contains(filters), "LIST must embed LIST_FILTERS");
        assertTrue(readStaticString("COUNT").contains(filters), "COUNT must embed LIST_FILTERS");
    }

    /**
     * OFFSET paging over a non-unique sort key is unsound: {@code created_at}
     * can repeat across jobs, PostgreSQL guarantees no order among tied rows,
     * and one page's query may then place them differently from the next
     * page's — dropping or repeating a job.
     */
    @Test
    void listOrdersByAUniqueTieBreakSoPagesCannotDropRows() throws Exception {
        assertTrue(
                readStaticString("LIST").contains("ORDER BY created_at DESC, id DESC"),
                "LIST must tie-break on id, or OFFSET paging can skip or repeat rows");
    }

    /**
     * A placeholder the caller's {@code Tuple} does not fill fails at execution
     * time, never at compile time: the filter tuple binds $1..$7 and the listing
     * adds the window as $8/$9.
     */
    @Test
    void listAndCountBindEveryPlaceholderTheyDeclare() throws Exception {
        assertEquals(9, highestPlaceholder(readStaticString("LIST")), "LIST binds tenant + 6 filters + limit/offset");
        assertEquals(7, highestPlaceholder(readStaticString("COUNT")), "COUNT binds tenant + 6 filters only");
    }

    private static int highestPlaceholder(String sql) {
        Matcher matcher = Pattern.compile("\\$(\\d+)").matcher(sql);
        int highest = 0;
        while (matcher.find()) {
            highest = Math.max(highest, Integer.parseInt(matcher.group(1)));
        }
        return highest;
    }

    private static String readStaticString(String name) throws Exception {
        Field field = AsyncJobRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
