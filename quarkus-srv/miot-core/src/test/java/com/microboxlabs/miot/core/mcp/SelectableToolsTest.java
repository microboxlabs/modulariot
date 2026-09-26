package com.microboxlabs.miot.core.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectableService;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import com.microboxlabs.miot.core.selectable.TestSelectables;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jose4j.jwt.JwtClaims;
import org.junit.jupiter.api.Test;

class SelectableToolsTest {

    private static final String ORG = "acme";
    private static final String OWNER = "owner@acme.test";
    private static final String MEMBER = "member@acme.test";

    /** Lets members of {@link #ORG} in, fills the tenant like the real check, and remembers who asked. */
    static final class FakeAccess extends OrganizationAccess {
        final TenantContext tenant;
        final OrganizationContext organization;
        final Set<String> members = Set.of(OWNER, MEMBER);
        final List<String> asked = new ArrayList<>();

        FakeAccess(TenantContext tenant, OrganizationContext organization) {
            super(tenant, organization, null);
            this.tenant = tenant;
            this.organization = organization;
        }

        @Override
        public Uni<Refusal> enter(String slug, String email, String m2mClientId) {
            asked.add(slug + "/" + email);
            if (!ORG.equals(slug) || !members.contains(email)) {
                return Uni.createFrom().item(new Refusal(Response.Status.FORBIDDEN,
                        "User is not a member of organization: " + slug));
            }
            tenant.setTenantCode("tenant-" + slug);
            organization.setUserEmail(email);
            return Uni.createFrom().nullItem();
        }
    }

    static final class FakeRoles extends OrganizationRoleService {
        final OrganizationContext organization;

        FakeRoles(OrganizationContext organization) {
            super(null, organization);
            this.organization = organization;
        }

        @Override
        public Uni<Void> requireOwner(String organizationSlug) {
            return OWNER.equals(organization.getUserEmail())
                    ? Uni.createFrom().voidItem()
                    : Uni.createFrom().failure(new ForbiddenException("Organization owner access required"));
        }
    }

    private final TenantContext tenant = new TenantContext();
    private final OrganizationContext organization = new OrganizationContext();
    private final FakeAccess access = new FakeAccess(tenant, organization);
    private final SelectableService service = TestSelectables.inMemory();

    private SelectableTools toolsFor(String email) {
        JwtClaims claims = new JwtClaims();
        claims.setSubject("auth0|" + email);
        claims.setClaim("email", email);
        QuarkusSecurityIdentity identity = QuarkusSecurityIdentity.builder()
                .setPrincipal(new DefaultJWTCallerPrincipal(claims))
                .build();
        McpCaller caller = new McpCaller(identity, access, new FakeRoles(organization), tenant,
                List.of("azp", "aud"));
        return new SelectableTools(caller, service);
    }

    private static SelectableRequest reasons() {
        return new SelectableRequest(Map.of("es", "Motivo", "en", "Reason"), Map.of(), SelectionMode.SINGLE,
                null, List.of(), null, List.of(
                        SelectableOption.of("traffic", "Tráfico", "Traffic"),
                        SelectableOption.of("weather", "Clima", "Weather")));
    }

    private static ToolCallException failure(Uni<?> call) {
        return assertThrows(ToolCallException.class, () -> call.await().indefinitely());
    }

    @Test
    void anOwnerWritesAListAsThemselvesInTheOrganizationNamed() {
        var saved = toolsFor(OWNER).replace(ORG, "delay_reason", reasons()).await().indefinitely();

        assertEquals("tenant-acme", saved.tenantCode());
        assertEquals(OWNER, saved.updatedBy());
        assertEquals(List.of("acme/" + OWNER), access.asked, "the caller is checked with the token's email");
    }

    @Test
    void aMemberReadsTheListsAndTheirOptions() {
        toolsFor(OWNER).replace(ORG, "delay_reason", reasons()).await().indefinitely();
        SelectableTools tools = toolsFor(MEMBER);

        assertEquals(List.of("delay_reason"), tools.list(ORG).await().indefinitely().selectables().stream()
                .map(s -> s.key()).toList());
        assertEquals(SelectionMode.SINGLE, tools.get(ORG, "delay_reason").await().indefinitely().mode());
        var found = tools.options(ORG, "delay_reason", "clima", null, null).await().indefinitely().options();
        assertEquals(List.of("weather"), found.stream().map(SelectableOption::value).toList());
    }

    @Test
    void aMemberWhoIsNotAnOwnerCannotWrite() {
        SelectableTools tools = toolsFor(MEMBER);

        assertEquals("Organization owner access required",
                failure(tools.replace(ORG, "delay_reason", reasons())).getMessage());
        failure(tools.delete(ORG, "delay_reason"));
        failure(tools.bind(ORG, Map.of("reason", "delay_reason")));
        assertTrue(service.list("tenant-acme").isEmpty(), "nothing was written");
    }

    @Test
    void someoneOutsideTheOrganizationIsRefused() {
        SelectableTools tools = toolsFor("stranger@else.test");

        assertEquals("User is not a member of organization: acme", failure(tools.list(ORG)).getMessage());
        assertEquals("organization is required", failure(tools.list(" ")).getMessage());
    }

    @Test
    void whatTheRestApiRefusesIsAFailedToolCall() {
        SelectableTools tools = toolsFor(OWNER);

        assertEquals("selectable not found: nope", failure(tools.get(ORG, "nope")).getMessage());
        assertEquals("selectable not found: nope", failure(tools.delete(ORG, "nope")).getMessage());
        assertEquals("unknown selectable: nope", failure(tools.bind(ORG, Map.of("reason", "nope"))).getMessage());
        SelectableRequest noMode = new SelectableRequest(Map.of("es", "Motivo"), null, null, null, null, null,
                null);
        assertEquals("mode is required (SINGLE or MULTIPLE)",
                failure(tools.replace(ORG, "delay_reason", noMode)).getMessage());
    }

    @Test
    void anOwnerBindsAFieldAndDeletesAList() {
        SelectableTools tools = toolsFor(OWNER);
        tools.replace(ORG, "delay_reason", reasons()).await().indefinitely();

        assertEquals(Map.of("reason", "delay_reason"),
                tools.bind(ORG, Map.of("reason", "delay_reason")).await().indefinitely().bindings());
        assertEquals("Deleted delay_reason.", tools.delete(ORG, "delay_reason").await().indefinitely());
        assertEquals(Map.of(), tools.bindings(ORG).await().indefinitely().bindings(),
                "the binding went with the list");
    }
}
