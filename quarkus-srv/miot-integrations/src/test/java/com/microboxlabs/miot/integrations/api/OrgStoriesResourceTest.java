package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateLinkRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkSnapshot;
import com.microboxlabs.miot.integrations.dto.StoryDtos.PatchStoryRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.SetCurrentVersionRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryShareRequest;
import com.microboxlabs.miot.integrations.dto.StoryDtos.VersionInput;
import com.microboxlabs.miot.integrations.service.InMemoryStories;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OrgStoriesResourceTest {

    private static final String ORG = "acme";
    private static final String OWNER = "owner@example.test";
    private static final String OTHER = "other@example.test";

    private final InMemoryStories store = new InMemoryStories();

    private final class Caller {
        final OrgStoriesResource stories;
        final OrgShareLinksResource links;

        Caller(String email) {
            TenantContext tenant = new TenantContext();
            tenant.setTenantCode("tenant-1");
            OrganizationContext organization = new OrganizationContext();
            organization.setOrganizationId(ORG);
            organization.setUserEmail(email);
            stories = new OrgStoriesResource(store.storyService, tenant, organization, null);
            links = new OrgShareLinksResource(store.linkService, tenant, organization, null);
        }
    }

    private static Response await(Uni<Response> call) {
        return call.await().indefinitely();
    }

    private static VersionInput markdown(String text) {
        return new VersionInput(null, null, null, null, text, null);
    }

    private StoryResponse created(Caller caller) {
        Response response = await(caller.stories.createStory(ORG,
                new CreateStoryRequest("Report", null, "markdown", null, null, markdown("# One"))));
        assertEquals(201, response.getStatus());
        return (StoryResponse) response.getEntity();
    }

    @Test
    void theStoryLifecycleOverRest() {
        Caller owner = new Caller(OWNER);
        String id = created(owner).id();

        Response added = await(owner.stories.addVersion(ORG, id, markdown("# Two")));
        assertEquals(201, added.getStatus());
        String second = ((StoryVersion) added.getEntity()).id();

        StoryResponse read = (StoryResponse) await(owner.stories.getStory(ORG, id)).getEntity();
        assertEquals("# Two", read.currentVersion().content());

        String first = ((List<?>) await(owner.stories.listVersions(ORG, id)).getEntity()).stream()
                .map(v -> ((StoryVersion) v).id()).filter(v -> !v.equals(second)).findFirst().orElseThrow();
        Response current = await(owner.stories.setCurrentVersion(ORG, id, new SetCurrentVersionRequest(first)));
        assertEquals(first, ((StoryResponse) current.getEntity()).currentVersionId());
        assertEquals("# One", ((StoryVersion) await(owner.stories.getVersion(ORG, id, first)).getEntity())
                .content());

        assertEquals("Renamed", ((StoryResponse) await(owner.stories.patchStory(ORG, id,
                new PatchStoryRequest("Renamed", null))).getEntity()).title());
        assertEquals(1, ((List<?>) await(owner.stories.listStories(ORG, null, "renam", null)).getEntity()).size());

        assertEquals(204, await(owner.stories.deleteStory(ORG, id)).getStatus());
        assertEquals(404, await(owner.stories.getStory(ORG, id)).getStatus());
    }

    @Test
    void someoneElsesStoryIsNotFoundUntilShared() {
        Caller owner = new Caller(OWNER);
        Caller other = new Caller(OTHER);
        String id = created(owner).id();

        assertEquals(404, await(other.stories.getStory(ORG, id)).getStatus());
        assertEquals(404, await(other.stories.addVersion(ORG, id, markdown("x"))).getStatus());
        assertEquals(404, await(other.stories.deleteStory(ORG, id)).getStatus());

        assertEquals(201, await(owner.stories.shareStory(ORG, id, new StoryShareRequest(OTHER, "read")))
                .getStatus());
        assertEquals(200, await(other.stories.getStory(ORG, id)).getStatus());
        assertEquals(404, await(other.stories.addVersion(ORG, id, markdown("x"))).getStatus(),
                "a reader cannot write");

        assertEquals(204, await(owner.stories.revokeShare(ORG, id, OTHER)).getStatus());
        assertEquals(404, await(other.stories.getStory(ORG, id)).getStatus());
    }

    @Test
    void invalidInputIsA400() {
        Caller owner = new Caller(OWNER);
        String id = created(owner).id();

        assertEquals(400, await(owner.stories.createStory(ORG,
                new CreateStoryRequest("t", null, "ppt", null, null, markdown("x")))).getStatus());
        assertEquals(400, await(owner.stories.getStory(ORG, "not-a-uuid")).getStatus());
        assertEquals(400, await(owner.stories.addVersion(ORG, id,
                new VersionInput(null, null, null, null, null, Map.of()))).getStatus());
        assertEquals(400, await(owner.stories.setCurrentVersion(ORG, id, null)).getStatus());
    }

    @Test
    void aLinkOpensForAnotherMemberUntilRevoked() {
        Caller owner = new Caller(OWNER);
        Caller other = new Caller(OTHER);
        String id = created(owner).id();

        assertEquals(404, await(other.links.createLink(ORG, new CreateLinkRequest("story", id))).getStatus());
        LinkResponse link = (LinkResponse) await(owner.links.createLink(ORG, new CreateLinkRequest("story", id)))
                .getEntity();
        assertEquals(1, ((List<?>) await(owner.links.listLinks(ORG, "story", id)).getEntity()).size());

        Response opened = await(other.links.resolveLink(ORG, link.token(), null, null));
        assertEquals(200, opened.getStatus());
        assertEquals("# One", ((LinkSnapshot) opened.getEntity()).version().content());

        assertEquals(404, await(other.links.revokeLink(ORG, link.token())).getStatus());
        assertEquals(204, await(owner.links.revokeLink(ORG, link.token())).getStatus());
        assertEquals(404, await(other.links.resolveLink(ORG, link.token(), null, null)).getStatus());
    }

    @Test
    void anotherOrganizationInThePathIsForbiddenAndNoIdentityIs401() {
        Caller owner = new Caller(OWNER);
        WebApplicationException refused = assertThrows(WebApplicationException.class,
                () -> owner.stories.listStories("other-org", null, null, null));
        assertEquals(403, refused.getResponse().getStatus());

        Caller nobody = new Caller(null);
        assertEquals(401, await(nobody.stories.listStories(ORG, null, null, null)).getStatus());
    }
}
