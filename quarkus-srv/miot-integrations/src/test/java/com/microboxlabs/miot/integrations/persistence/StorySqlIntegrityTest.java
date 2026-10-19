package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;

/**
 * Guards the clauses of the story and link SQL that access rests on, which the
 * service tests do not reach because they run against in-memory repositories.
 */
class StorySqlIntegrityTest {

    @Test
    void storyReadsScopeToTheTenantAndHideDeletedStories() throws Exception {
        for (String name : new String[] {"FIND_STORY", "LIST_OWNED", "UPDATE_STORY", "SET_CURRENT"}) {
            String sql = read(StoryRepository.class, name);
            assertTrue(sql.contains("tenant_code = $"), name + " must scope to the tenant");
            assertTrue(sql.contains("deleted_at IS NULL"), name + " must hide deleted stories");
        }
        String shared = read(StoryRepository.class, "LIST_SHARED_WITH");
        assertTrue(shared.contains("s.tenant_code = $1") && shared.contains("sh.principal = $2"));
        assertTrue(shared.contains("s.deleted_at IS NULL"));
    }

    @Test
    void theCurrentVersionMustBelongToTheStory() throws Exception {
        assertTrue(read(StoryRepository.class, "SET_CURRENT").contains("v.story_id = s.id"));
        assertTrue(read(StoryRepository.class, "FIND_VERSION").contains("story_id = $2"));
    }

    @Test
    void aVersionIsAddedOnlyToALiveStoryAndBecomesCurrent() throws Exception {
        String sql = read(StoryRepository.class, "ADD_VERSION");
        assertTrue(sql.contains("tenant_code = $3 AND deleted_at IS NULL"));
        assertTrue(sql.contains("SET current_version_id = $1"));
    }

    @Test
    void deletingNeedsTheOwner() throws Exception {
        assertTrue(read(StoryRepository.class, "SOFT_DELETE_STORY").contains("owner_id = $3"));
    }

    @Test
    void linksResolveInsideTheirTenantAndNotOnceRevoked() throws Exception {
        String sql = read(ShareLinkRepository.class, "FIND_ACTIVE");
        assertTrue(sql.contains("tenant_code = $2") && sql.contains("revoked_at IS NULL"));
        assertTrue(read(ShareLinkRepository.class, "REVOKE").contains("tenant_code = $2"));
    }

    private static String read(Class<?> type, String name) throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
