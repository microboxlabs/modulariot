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

    private static String readStaticString(String name) throws Exception {
        Field field = InteractionEpisodeRepository.class.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
