package com.microboxlabs.miot.conversational.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Guards against the Java text-block trailing-whitespace strip that glued
 * {@code RETURNING} to the first returned column (producing {@code RETURNINGid}) — a
 * syntax error that only surfaces against a real Postgres, never in stubbed unit tests.
 * Reads the private SQL constants reflectively (no DB needed).
 */
class ConversationalSqlIntegrityTest {

    /** RETURNING immediately followed by a non-whitespace char = the glue bug. */
    private static final Pattern RETURNING_GLUED = Pattern.compile("RETURNING\\S");

    @Test
    void returningKeywordIsSeparatedFromColumnsInEveryStatement() throws Exception {
        assertSeparated(MessageRepository.class, "INSERT");
        assertSeparated(MessageRepository.class, "INSERT_IF_NEW");
        assertSeparated(MessageRepository.class, "MARK_STATUS");
        assertSeparated(ConversationRepository.class, "INSERT");
        assertSeparated(ConversationRepository.class, "UPDATE_OUTBOUND");
        assertSeparated(ConversationRepository.class, "UPDATE_INBOUND");
        assertSeparated(ConversationRepository.class, "RESET_UNREAD");
    }

    private static void assertSeparated(Class<?> type, String field) throws Exception {
        String sql = readStaticString(type, field);
        assertTrue(sql.contains("RETURNING"), field + " is expected to contain a RETURNING clause");
        assertFalse(
                RETURNING_GLUED.matcher(sql).find(),
                type.getSimpleName() + "." + field + " glues RETURNING to the next token:\n" + sql);
    }

    private static String readStaticString(Class<?> type, String name) throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
