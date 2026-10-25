package com.microboxlabs.miot.core.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.CoreAccessCatalog;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.groups.UniAwait;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** {@code /api/v1/orgs/_platform/...}: platform owners only, on the resources that serve the platform scope. */
class PlatformScopeFilterTest {

    private static final String OWNER = "owner@example.test";
    private static final String MEMBER = "member@example.test";
    private static final String DISABLED_OWNER = "disabled-owner@example.test";

    private final TenantContext tenant = new TenantContext();
    private final OrganizationContext organization = new OrganizationContext();
    private final FakePlatform platform = new FakePlatform();
    private final AccessEvaluator evaluator = new AccessEvaluator(
            new AccessRegistry(List.of(new CoreAccessCatalog())), platform, null, null);
    private final OrganizationAccess access = new OrganizationAccess(tenant, organization, evaluator);
    private final OrganizationRequestFilter filter = new OrganizationRequestFilter(tenant, null, access, platform,
            List.of("aud", "azp"), "/api/v1/orgs/", List.of("/api/v1/asset/track"));

    @Test
    void aPlatformOwnerEntersThePlatformScopeAsItsTenant() {
        platform.caller = OWNER;

        assertNull(filter("/api/v1/orgs/_platform/integrations/connections"));

        assertEquals("_platform", tenant.getTenantCode());
        assertEquals("_platform", tenant.getClientId());
        assertEquals(List.of("_platform"), tenant.getEffectiveClientIds());
        assertEquals("_platform", organization.getOrganizationId());
        assertEquals(OWNER, organization.getUserEmail());
        assertEquals("OWNER", organization.getBaseRole());
    }

    @Test
    void everySupportedResourceLetsTheOwnerIn() {
        platform.caller = OWNER;
        for (String path : List.of("me/access", "integrations/credential-profiles/abc/test",
                "integrations/templates", "conversations/rules/panic")) {
            assertNull(filter("/api/v1/orgs/_platform/" + path), path);
        }
    }

    @Test
    void someoneElseIsRefused() {
        platform.caller = MEMBER;

        Response refused = filter("/api/v1/orgs/_platform/integrations/connections");

        assertEquals(403, refused.getStatus());
        assertNull(tenant.getTenantCode());
        assertFalse(organization.isResolved());
    }

    @Test
    void aPlatformOwnerWhoseUserIsDisabledIsRefused() {
        platform.caller = DISABLED_OWNER;

        assertEquals(403, filter("/api/v1/orgs/_platform/integrations/connections").getStatus());
        assertNull(tenant.getTenantCode());
    }

    @Test
    void aRequestWithoutAVerifiedEmailIsRefused() {
        platform.caller = null;

        assertEquals(403, filter("/api/v1/orgs/_platform/integrations/connections").getStatus());
    }

    @Test
    void anotherReservedSlugIsNotFound() {
        platform.caller = OWNER;

        assertEquals(404, filter("/api/v1/orgs/_other/integrations/connections").getStatus());
        assertEquals(404, filter("/api/v1/orgs/_/team").getStatus());
    }

    @Test
    void aResourceThatNeedsAnOrganizationIsNotFoundInThePlatformScope() {
        platform.caller = OWNER;
        for (String path : List.of("team", "modules", "fleet/assets", "trips/trips", "gps/integration",
                "control-tower/contacts", "selectables", "integrations/bindings", "whatsapp/outbound",
                "conversationsx", "")) {
            assertEquals(404, filter("/api/v1/orgs/_platform/" + path).getStatus(), path);
        }
        assertEquals(404, filter("/api/v1/orgs/_platform").getStatus());
        assertNull(tenant.getTenantCode());
    }

    @Test
    void theScopeIsNotEnteredByName() {
        Response.Status status = access.enter("_platform", Caller.user(OWNER)).await().indefinitely().status();

        assertEquals(Response.Status.NOT_FOUND, status);
    }

    @Test
    void onlyAPlatformOwnerIsOwnerOfThePlatformScope() {
        Access owner = evaluator.evaluate("_platform", Caller.user(OWNER)).await().indefinitely();
        Access member = evaluator.evaluate("_platform", Caller.user(MEMBER)).await().indefinitely();

        assertEquals("OWNER", owner.baseRole().name());
        assertFalse(owner.permissions().isEmpty());
        assertFalse(member.member());
        assertFalse(evaluator.evaluate("_platform", Caller.client("m2m")).await().indefinitely().member());
        assertFalse(evaluator.evaluate("_other", Caller.user(OWNER)).await().indefinitely().member());
    }

    @Test
    void ownerChecksOfOrgResourcesPassForAPlatformOwner() {
        OrganizationRoleService roles = new OrganizationRoleService(organization, evaluator, null);

        organization.setUserEmail(OWNER);
        roles.requireOwner("_platform").await().indefinitely();

        organization.setUserEmail(MEMBER);
        UniAwait<Void> memberCheck = roles.requireOwner("_platform").await();
        assertThrows(ForbiddenException.class, memberCheck::indefinitely);
        organization.setUserEmail(OWNER);
        UniAwait<Void> otherCheck = roles.requireOwner("_other").await();
        assertThrows(ForbiddenException.class, otherCheck::indefinitely);
    }

    @Test
    void theAllowListMatchesWholeSegments() {
        assertTrue(PlatformScope.supports("/conversations"));
        assertTrue(PlatformScope.supports("integrations/connections/1/test"));
        assertFalse(PlatformScope.supports("integrations/connectionsx"));
        assertFalse(PlatformScope.supports("integrations"));
        assertTrue(PlatformScope.supports("control-tower/symptom-definitions/1/draft"));
        assertTrue(PlatformScope.supports("control-tower/data-sources"));
        assertFalse(PlatformScope.supports("control-tower/map"));
        assertTrue(PlatformScope.supports("integrations/console/jobs/overview"));
    }

    private Response filter(String path) {
        UriInfo uri = (UriInfo) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {UriInfo.class},
                (proxy, method, args) -> "getPath".equals(method.getName()) ? path : null);
        ContainerRequestContext request = (ContainerRequestContext) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {ContainerRequestContext.class},
                (proxy, method, args) -> "getUriInfo".equals(method.getName()) ? uri : null);
        return filter.filter(request).await().indefinitely();
    }

    /** The caller's verified email; {@value #OWNER} and {@value #DISABLED_OWNER} hold the owner role. */
    private static final class FakePlatform extends PlatformAuthorizer {
        String caller;

        FakePlatform() {
            super(Optional.empty(), null);
        }

        @Override
        public String callerEmail() {
            return caller;
        }

        @Override
        protected Uni<Boolean> hasOwnerAssignment(String email) {
            return Uni.createFrom().item(OWNER.equals(email) || DISABLED_OWNER.equals(email));
        }

        @Override
        protected Uni<Boolean> accountActive(String email) {
            return Uni.createFrom().item(!DISABLED_OWNER.equals(email));
        }
    }
}
