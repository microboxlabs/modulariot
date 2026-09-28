package com.microboxlabs.miot.integrations.service;

import static com.microboxlabs.miot.integrations.service.StoryServiceTest.OTHER;
import static com.microboxlabs.miot.integrations.service.StoryServiceTest.OWNER;
import static com.microboxlabs.miot.integrations.service.StoryServiceTest.TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateLinkRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkSnapshot;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryShareRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ShareLinkServiceTest {

    private static final String ORG = "acme";

    private final InMemoryStories store = new InMemoryStories();
    private final ShareLinkService links = store.linkService;

    private String newStory(String owner) {
        return store.storyService.create(TENANT, owner, new CreateStoryRequest("Report", null, "markdown", null,
                null, StoryServiceTest.markdown("# Report"))).id();
    }

    @Test
    void aStoryLinkOpensTheCurrentVersionForAnotherMember() {
        String id = newStory(OWNER);
        LinkResponse link = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id));

        assertEquals(43, link.token().length(), "32 random bytes, base64url without padding");
        assertTrue(link.token().matches("[A-Za-z0-9_-]+"));
        assertEquals("/api/v1/orgs/acme/links/" + link.token(), link.path());
        assertEquals("org", link.access());

        LinkSnapshot snapshot = links.resolve(TENANT, OTHER, link.token(), null, null);
        assertEquals("story", snapshot.targetType());
        assertEquals("# Report", snapshot.version().content());
        assertEquals(StoryService.READ, snapshot.story().permission());
        assertNull(snapshot.thread());
        assertNull(store.storyService.get(TENANT, OTHER, id), "the link does not grant a share");
    }

    @Test
    void creatingAgainReturnsTheActiveLink() {
        String id = newStory(OWNER);
        String first = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token();

        assertEquals(first, links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token());
        assertEquals(1, links.list(ORG, TENANT, OWNER, "story", id).orElseThrow().size());
    }

    @Test
    void aRequestThatLosesTheRaceGetsTheLinkTheOtherOneMade() {
        String id = newStory(OWNER);
        String first = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token();

        store.links.missNextListing = true;

        assertEquals(first, links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token());
        assertEquals(1, store.links.rows.size());
    }

    @Test
    void onlyTheOwnerMakesListsOrRevokesLinks() {
        String id = newStory(OWNER);
        store.storyService.share(TENANT, OWNER, id,
                new StoryShareRequest(OTHER, "write"));

        assertNull(links.create(ORG, TENANT, OTHER, new CreateLinkRequest("story", id)));
        String token = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token();
        assertTrue(links.list(ORG, TENANT, OTHER, "story", id).isEmpty());
        assertFalse(links.revoke(TENANT, OTHER, token));
        assertNotNull(links.resolve(TENANT, OTHER, token, null, null));
    }

    @Test
    void aRevokedLinkNoLongerOpens() {
        String id = newStory(OWNER);
        String token = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token();

        assertTrue(links.revoke(TENANT, OWNER, token));
        assertNull(links.resolve(TENANT, OTHER, token, null, null));
        assertFalse(links.revoke(TENANT, OWNER, token));
        assertTrue(links.list(ORG, TENANT, OWNER, "story", id).orElseThrow().isEmpty());
    }

    @Test
    void aLinkToADeletedStoryNoLongerOpens() {
        String id = newStory(OWNER);
        String token = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token();

        store.storyService.delete(TENANT, OWNER, id);

        assertNull(links.resolve(TENANT, OTHER, token, null, null));
    }

    @Test
    void aLinkOpensOnlyInsideItsTenant() {
        String id = newStory(OWNER);
        String token = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("story", id)).token();

        assertNull(links.resolve("tenant-2", OTHER, token, null, null));
    }

    @Test
    void aThreadLinkOpensTheTranscriptPageByPage() {
        String threadId = UUID.randomUUID().toString();
        store.threads.add(threadId, TENANT, OWNER, "Chat");
        for (int i = 1; i <= 3; i++) {
            store.threads.addMessage(threadId, "m" + i);
        }

        assertNull(links.create(ORG, TENANT, OTHER, new CreateLinkRequest("thread", threadId)),
                "only the thread's owner links it");
        String token = links.create(ORG, TENANT, OWNER, new CreateLinkRequest("thread", threadId)).token();

        LinkSnapshot first = links.resolve(TENANT, OTHER, token, null, 2);
        assertEquals("thread", first.targetType());
        assertEquals("Chat", first.thread().title());
        assertFalse(first.thread().owned());
        assertEquals(2, first.messages().size());
        LinkSnapshot rest = links.resolve(TENANT, OTHER, token, first.messages().get(1).seq(), 2);
        assertEquals("m3", rest.messages().stream().map(HarnessThreadMessage::id).findFirst().orElseThrow());
    }

    @Test
    void malformedRequestsAreRefusedAndMalformedTokensAreUnknown() {
        var badType = new CreateLinkRequest("dashboard", UUID.randomUUID().toString());
        var badId = new CreateLinkRequest("story", "nope");

        assertThrows(IllegalArgumentException.class, () -> links.create(ORG, TENANT, OWNER, badType));
        assertThrows(IllegalArgumentException.class, () -> links.create(ORG, TENANT, OWNER, badId));
        assertNull(links.resolve(TENANT, OWNER, "short", null, null));
        assertNull(links.resolve(TENANT, OWNER, "has spaces and more than sixteen", null, null));
        assertNull(links.resolve(TENANT, OWNER, null, null, null));
    }
}
