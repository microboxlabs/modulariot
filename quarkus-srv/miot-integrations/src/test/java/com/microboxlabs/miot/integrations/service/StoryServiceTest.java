package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.StoryVersion;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.PatchStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.ShareEntry;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryShareRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.VersionInput;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StoryServiceTest {

    static final String TENANT = "tenant-1";
    static final String OWNER = "owner@example.test";
    static final String OTHER = "other@example.test";

    private final InMemoryStories store = new InMemoryStories();
    private final StoryService service = store.storyService;

    static VersionInput markdown(String text) {
        return new VersionInput(null, null, null, null, text, null);
    }

    private StoryResponse newStory(String owner, String title) {
        return service.create(TENANT, owner, new CreateStoryRequest(title, null, "markdown", null, null,
                markdown("# " + title)));
    }

    @Test
    void creatingAStoryStoresItsFirstVersionAsCurrent() {
        StoryResponse created = service.create(TENANT, OWNER, new CreateStoryRequest(
                "  Weekly report ", "Trips by day", "markdown", UUID.randomUUID().toString(), "msg-1",
                markdown("# Report")));

        assertEquals("Weekly report", created.title());
        assertTrue(created.owned());
        assertEquals(StoryService.OWNER, created.permission());

        StoryResponse read = service.get(TENANT, OWNER, created.id());
        assertEquals("# Report", read.currentVersion().content());
        assertEquals("text/markdown", read.currentVersion().contentType());
        assertEquals("v1", read.currentVersion().label());
        assertEquals(created.currentVersionId(), read.currentVersion().id());
    }

    @Test
    void aStoryIsPrivateToItsOwner() {
        String id = newStory(OWNER, "Mine").id();

        assertNull(service.get(TENANT, OTHER, id));
        assertTrue(service.listVersions(TENANT, OTHER, id).isEmpty());
        assertTrue(service.list(TENANT, OTHER, null, null, null).isEmpty());
        assertNull(service.get("tenant-2", OWNER, id), "a story is only reachable in its own tenant");
    }

    @Test
    void aReadShareOpensTheStoryButDoesNotWriteIt() {
        String id = newStory(OWNER, "Mine").id();
        service.share(TENANT, OWNER, id, new StoryShareRequest(OTHER, null));

        StoryResponse read = service.get(TENANT, OTHER, id);
        assertEquals(StoryService.READ, read.permission());
        assertFalse(read.owned());
        assertTrue(read.sharedWith().isEmpty(), "a reader does not see who else it is shared with");
        assertNull(service.addVersion(TENANT, OTHER, id, markdown("# Theirs")));
        assertNull(service.patch(TENANT, OTHER, id, new PatchStoryRequest("Theirs", null)));
        assertFalse(service.delete(TENANT, OTHER, id));
    }

    @Test
    void aWriteShareAddsVersionsButDoesNotDeleteOrReshare() {
        String id = newStory(OWNER, "Mine").id();
        service.share(TENANT, OWNER, id, new StoryShareRequest(OTHER, "write"));

        assertNotNull(service.addVersion(TENANT, OTHER, id, markdown("# Edited")));
        assertEquals("Renamed", service.patch(TENANT, OTHER, id, new PatchStoryRequest("Renamed", null)).title());
        assertFalse(service.delete(TENANT, OTHER, id));
        assertNull(service.share(TENANT, OTHER, id, new StoryShareRequest("third@example.test", null)));
        assertEquals(List.of(new ShareEntry(OTHER, "write")), service.get(TENANT, OWNER, id).sharedWith());
    }

    @Test
    void aNewVersionBranchesFromTheCurrentOneAndBecomesCurrent() {
        StoryResponse created = newStory(OWNER, "Mine");
        String first = created.currentVersionId();

        StoryVersion second = service.addVersion(TENANT, OWNER, created.id(), markdown("# Two"));
        assertEquals(first, second.parentId());
        assertEquals("v2", second.label());
        assertEquals(second.id(), service.get(TENANT, OWNER, created.id()).currentVersionId());

        StoryVersion branch = service.addVersion(TENANT, OWNER, created.id(),
                new VersionInput(first, "Alt", "Another take", null, "# Alt", null));
        assertEquals(first, branch.parentId(), "an explicit parent starts a branch");

        StoryResponse back = service.setCurrentVersion(TENANT, OWNER, created.id(), second.id());
        assertEquals(second.id(), back.currentVersionId());
        assertEquals("# Two", service.get(TENANT, OWNER, created.id()).currentVersion().content());

        List<StoryVersion> versions = service.listVersions(TENANT, OWNER, created.id()).orElseThrow();
        assertEquals(3, versions.size());
        assertNull(versions.get(0).content(), "the listing leaves content out");
        assertEquals("# Alt", service.getVersion(TENANT, OWNER, created.id(), branch.id()).content());
    }

    @Test
    void aParentOrCurrentVersionFromAnotherStoryIsRefused() {
        String one = newStory(OWNER, "One").id();
        StoryResponse two = newStory(OWNER, "Two");
        var foreignParent = new VersionInput(two.currentVersionId(), null, null, null, "# x", null);

        assertThrows(IllegalArgumentException.class, () -> service.addVersion(TENANT, OWNER, one, foreignParent));
        assertNull(service.setCurrentVersion(TENANT, OWNER, one, two.currentVersionId()));
    }

    @Test
    void listingFiltersByKindAndTitleAndPutsOwnStoriesFirst() {
        newStory(OWNER, "Fleet report");
        newStory(OWNER, "100% on time");
        service.create(TENANT, OWNER, new CreateStoryRequest("Fleet chart", null, "svg", null, null,
                markdown("<svg/>")));
        String shared = newStory(OTHER, "Fleet shared").id();
        service.share(TENANT, OTHER, shared, new StoryShareRequest(OWNER, "read"));

        assertEquals(List.of("Fleet report", "100% on time", "Fleet chart", "Fleet shared"),
                titles(service.list(TENANT, OWNER, null, null, null)));
        assertEquals(List.of("Fleet chart"), titles(service.list(TENANT, OWNER, "svg", null, null)));
        assertEquals(List.of("Fleet report", "Fleet chart", "Fleet shared"),
                titles(service.list(TENANT, OWNER, null, "fleet", null)));
        assertEquals(List.of("100% on time"), titles(service.list(TENANT, OWNER, null, "0%", null)),
                "a % in the search is literal");
        assertEquals(List.of("Fleet report"), titles(service.list(TENANT, OWNER, null, null, 1)));
    }

    @Test
    void deletingHidesTheStory() {
        String id = newStory(OWNER, "Mine").id();

        assertTrue(service.delete(TENANT, OWNER, id));
        assertNull(service.get(TENANT, OWNER, id));
        assertFalse(service.delete(TENANT, OWNER, id));
    }

    @Test
    void anEmptyDescriptionClearsIt() {
        String id = service.create(TENANT, OWNER, new CreateStoryRequest("t", "about", "markdown", null, null,
                markdown("x"))).id();

        assertEquals("about", service.patch(TENANT, OWNER, id, new PatchStoryRequest("t2", null)).description());
        assertNull(service.patch(TENANT, OWNER, id, new PatchStoryRequest(null, "")).description());
    }

    @Test
    void aDeckMayCarryOnlyMetadata() {
        Map<String, Object> deck = Map.of("slides", List.of(Map.of("type", "title", "title", "Q3")));
        StoryResponse created = service.create(TENANT, OWNER, new CreateStoryRequest("Deck", null, "deck", null,
                null, new VersionInput(null, null, null, null, null, deck)));

        StoryVersion current = service.get(TENANT, OWNER, created.id()).currentVersion();
        assertEquals(deck, current.metadata());
        assertEquals("application/vnd.miot.deck+json", current.contentType());
    }

    @Test
    void aPdfMustBeBase64() {
        String pdf = Base64.getEncoder().encodeToString("%PDF-1.7".getBytes());
        assertNotNull(service.create(TENANT, OWNER, new CreateStoryRequest("Pdf", null, "pdf", null, null,
                markdown(pdf))));

        var notBase64 = new CreateStoryRequest("Pdf", null, "pdf", null, null, markdown("%PDF-1.7 raw"));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, notBase64));
    }

    @Test
    void oversizedContentAndMetadataAreRefused() {
        String id = newStory(OWNER, "Mine").id();
        // Two bytes each in UTF-8: under the limit by length, over it in bytes.
        var content = markdown("ñ".repeat(StoryService.MAX_CONTENT_BYTES / 2 + 1));
        var metadata = new VersionInput(null, null, null, null, null,
                Map.of("data", "x".repeat(StoryService.MAX_METADATA_BYTES)));

        assertThrows(IllegalArgumentException.class, () -> service.addVersion(TENANT, OWNER, id, content));
        assertThrows(IllegalArgumentException.class, () -> service.addVersion(TENANT, OWNER, id, metadata));
        assertEquals(1, store.stories.versions.get(id).size(), "nothing was stored");
    }

    @Test
    void malformedInputIsRefused() {
        String id = newStory(OWNER, "Mine").id();
        var noKind = new CreateStoryRequest("t", null, "ppt", null, null, markdown("x"));
        var noTitle = new CreateStoryRequest(" ", null, "markdown", null, null, markdown("x"));
        var noVersion = new CreateStoryRequest("t", null, "markdown", null, null, null);
        var empty = new CreateStoryRequest("t", null, "markdown", null, null, markdown(""));
        var badThread = new CreateStoryRequest("t", null, "markdown", "thread-1", null, markdown("x"));
        var selfShare = new StoryShareRequest(OWNER, null);
        var adminShare = new StoryShareRequest(OTHER, "admin");

        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, noKind));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, noTitle));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, noVersion));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, empty));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, OWNER, badThread));
        assertThrows(IllegalArgumentException.class, () -> service.get(TENANT, OWNER, "not-a-uuid"));
        assertThrows(IllegalArgumentException.class, () -> service.share(TENANT, OWNER, id, selfShare));
        assertThrows(IllegalArgumentException.class, () -> service.share(TENANT, OWNER, id, adminShare));
        assertThrows(IllegalArgumentException.class, () -> service.list(TENANT, OWNER, "ppt", null, null));
    }

    @Test
    void revokingAShareTakesTheStoryOutOfView() {
        String id = newStory(OWNER, "Mine").id();
        service.share(TENANT, OWNER, id, new StoryShareRequest(OTHER, "read"));

        assertTrue(service.revokeShare(TENANT, OWNER, id, OTHER));
        assertNull(service.get(TENANT, OTHER, id));
        assertFalse(service.revokeShare(TENANT, OWNER, id, OTHER));
    }

    @Test
    void theTitlePatternEscapesWildcards() {
        assertEquals("%a\\%b\\_c\\\\d%", StoryService.titlePattern(" a%b_c\\d "));
        assertNull(StoryService.titlePattern("  "));
    }

    private static List<String> titles(List<StoryResponse> stories) {
        return stories.stream().map(StoryResponse::title).toList();
    }
}
