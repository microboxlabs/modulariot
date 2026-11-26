package com.microboxlabs.miot.core.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.TeamsService;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DashboardTeamsFilterTest {

    private static final String EMAIL = "member@example.test";
    private static final UUID TEAM_ID = UUID.fromString("00112233-4455-6677-8899-aabbccddeeff");

    private final OrganizationContext organization = new OrganizationContext();
    private final DashboardTeamsContext teams = new DashboardTeamsContext();
    private final FakeTeams service = new FakeTeams();

    @Test
    void absentOrBlankProxyKeysSkipTheLookup() {
        for (Optional<String> key : List.of(Optional.<String>empty(), Optional.of(""), Optional.of("  "))) {
            filter(key);

            assertEquals(0, service.lookups);
            assertEquals(List.of(), teams.teamIds());
        }
    }

    @Test
    void configuredProxyLooksUpTheOrganizationsCaller() {
        filter(Optional.of("0123456789abcdef0123456789abcdef"));

        assertEquals(1, service.lookups);
        assertEquals("acme", service.slug);
        assertEquals(Caller.user(EMAIL), service.caller);
        assertEquals(List.of(TEAM_ID.toString()), teams.teamIds());
    }

    private void filter(Optional<String> key) {
        organization.setOrganizationId("acme");
        organization.setUserEmail(EMAIL);
        var support = new DashboardProxySupport(organization, teams, "default", key);
        var filter = new DashboardTeamsFilter(organization, teams, service, support, "/api/v1/orgs/");
        UriInfo uri = (UriInfo) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {UriInfo.class},
                (proxy, method, args) -> "getPath".equals(method.getName()) ? "/api/v1/orgs/acme/dashboards" : null);
        ContainerRequestContext request = (ContainerRequestContext) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {ContainerRequestContext.class},
                (proxy, method, args) -> "getUriInfo".equals(method.getName()) ? uri : null);

        assertNull(filter.filter(request).await().atMost(Duration.ofSeconds(1)));
    }

    private static final class FakeTeams extends TeamsService {
        int lookups;
        String slug;
        Caller caller;

        FakeTeams() {
            super(null, null, null);
        }

        @Override
        public Uni<List<TeamRef>> teamsOf(String slug, Caller caller) {
            lookups++;
            this.slug = slug;
            this.caller = caller;
            return Uni.createFrom().item(List.of(new TeamRef(TEAM_ID, "Operations")));
        }
    }
}
