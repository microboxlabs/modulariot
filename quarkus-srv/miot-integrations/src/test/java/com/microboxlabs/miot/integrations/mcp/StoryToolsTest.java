package com.microboxlabs.miot.integrations.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.mcp.McpCaller;
import com.microboxlabs.miot.integrations.domain.StoryVersion;
import com.microboxlabs.miot.integrations.dto.StoryDtos.LinkResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.StoryResponse;
import com.microboxlabs.miot.integrations.dto.StoryDtos.VersionInput;
import com.microboxlabs.miot.integrations.service.InMemoryStories;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jose4j.jwt.JwtClaims;
import org.junit.jupiter.api.Test;

class StoryToolsTest {

    private static final String ORG = "acme";
    private static final String OWNER = "owner@acme.test";
    private static final String MEMBER = "member@acme.test";

    /** Lets members of {@link #ORG} in and fills the tenant like the real check. */
    static final class FakeAccess extends OrganizationAccess {
        final TenantContext tenant;
        final OrganizationContext organization;

        FakeAccess(TenantContext tenant, OrganizationContext organization) {
            super(tenant, organization, null, null);
            this.tenant = tenant;
            this.organization = organization;
        }

        @Override
        public Uni<Refusal> enter(String slug, String email, String m2mClientId) {
            if (!ORG.equals(slug) || !Set.of(OWNER, MEMBER).contains(email)) {
                return Uni.createFrom().item(new Refusal(Response.Status.FORBIDDEN,
                        "User is not a member of organization: " + slug));
            }
            tenant.setTenantCode("tenant-" + slug);
            organization.setUserEmail(email);
            return Uni.createFrom().nullItem();
        }
    }

    private final InMemoryStories store = new InMemoryStories();

    private StoryTools toolsFor(String email) {
        JwtClaims claims = new JwtClaims();
        claims.setSubject("auth0|" + email);
        claims.setClaim("email", email);
        QuarkusSecurityIdentity identity = QuarkusSecurityIdentity.builder()
                .setPrincipal(new DefaultJWTCallerPrincipal(claims))
                .build();
        TenantContext tenant = new TenantContext();
        OrganizationContext organization = new OrganizationContext();
        McpCaller caller = new McpCaller(identity, new FakeAccess(tenant, organization), null, tenant,
                List.of("azp", "aud"));
        return new StoryTools(caller, store.storyService, store.linkService);
    }

    private static <T> T await(Uni<T> call) {
        return call.await().indefinitely();
    }

    private static ToolCallException failure(Uni<?> call) {
        var awaiting = call.await();
        return assertThrows(ToolCallException.class, awaiting::indefinitely);
    }

    private static VersionInput text(String content) {
        return new VersionInput(null, null, null, null, content, null);
    }

    private StoryResponse report(StoryTools tools) {
        return await(tools.create(ORG, "Weekly report", "markdown", text("# One"), "Trips by day", null, null));
    }

    @Test
    void aStoryIsCreatedAsTheCallerInTheOrganizationNamed() {
        StoryResponse created = report(toolsFor(OWNER));

        assertEquals(OWNER, created.ownerId());
        assertEquals("tenant-acme", store.stories.rows.get(created.id()).tenantCode());
        assertEquals(List.of("Weekly report"), await(toolsFor(OWNER).list(ORG, null, "weekly", null)).stories()
                .stream().map(StoryResponse::title).toList());
        assertTrue(await(toolsFor(MEMBER).list(ORG, null, null, null)).stories().isEmpty(),
                "a story is private to whoever created it");
    }

    @Test
    void versionsAreAddedReadAndSwitched() {
        StoryTools tools = toolsFor(OWNER);
        StoryResponse created = report(tools);

        StoryVersion second = await(tools.addVersion(ORG, created.id(),
                new VersionInput(null, "Draft 2", "Adds totals", null, "# Two", null)));
        assertEquals("Draft 2", second.label());
        assertNull(second.content(), "the tool does not echo the content back");
        assertEquals(created.currentVersionId(), second.parentId());

        StoryTools.StoryView view = await(tools.get(ORG, created.id(), null));
        assertEquals("# Two", view.version().content());
        assertEquals(2, view.versions().size());
        assertEquals("# One", await(tools.get(ORG, created.id(), created.currentVersionId())).version().content());

        assertEquals(created.currentVersionId(),
                await(tools.setCurrent(ORG, created.id(), created.currentVersionId())).currentVersionId());
    }

    @Test
    void aDeckIsCreatedFromMetadataAlone() {
        Map<String, Object> deck = Map.of("slides", List.of(Map.of("type", "title", "title", "Q3")));
        StoryResponse created = await(toolsFor(OWNER).create(ORG, "Q3", "deck",
                new VersionInput(null, null, null, null, null, deck), null, null, null));

        assertEquals(deck, await(toolsFor(OWNER).get(ORG, created.id(), null)).version().metadata());
    }

    @Test
    void theOwnerGetsALinkAnotherMemberCannot() {
        StoryResponse created = report(toolsFor(OWNER));

        LinkResponse link = await(toolsFor(OWNER).link(ORG, created.id()));
        assertEquals("/api/v1/orgs/acme/links/" + link.token(), link.path());
        assertEquals("story not found: " + created.id(), failure(toolsFor(MEMBER).link(ORG, created.id()))
                .getMessage());
    }

    @Test
    void refusalsAreFailedToolCalls() {
        StoryTools tools = toolsFor(OWNER);
        String missing = "00000000-0000-0000-0000-000000000000";

        assertEquals("User is not a member of organization: acme",
                failure(toolsFor("stranger@else.test").list(ORG, null, null, null)).getMessage());
        assertEquals("organization is required", failure(tools.list(" ", null, null, null)).getMessage());
        assertEquals("story not found: " + missing, failure(tools.get(ORG, missing, null)).getMessage());
        assertEquals("storyId must be a UUID", failure(tools.get(ORG, "nope", null)).getMessage());
        assertTrue(failure(tools.create(ORG, "t", "ppt", text("x"), null, null, null))
                .getMessage().startsWith("kind must be one of"));
        assertEquals("version body is required", failure(tools.addVersion(ORG, missing, null)).getMessage());
    }
}
