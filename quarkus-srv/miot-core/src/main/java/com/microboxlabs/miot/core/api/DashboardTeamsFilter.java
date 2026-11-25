package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.TeamsService;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.server.ServerRequestFilter;

/**
 * Looks up the caller's teams for the dashboard proxies, so they can assert
 * them to the dashboard server and a dashboard shared with a team reaches its
 * members.
 *
 * <p>Runs after {@code OrganizationRequestFilter} has let the caller in, and
 * only on the dashboard paths ({@code /api/v1/orgs/{slug}/dashboard...}), so no
 * other request pays for the lookup. A failed lookup is logged and the request
 * goes on without teams: it then only loses what a team would have granted.
 */
public class DashboardTeamsFilter {

    private static final Logger LOG = Logger.getLogger(DashboardTeamsFilter.class);
    private static final String DASHBOARD_SEGMENT = "/dashboard";

    private final OrganizationContext organizationContext;
    private final DashboardTeamsContext teamsContext;
    private final TeamsService teamsService;
    private final String orgPathPrefix;

    @Inject
    public DashboardTeamsFilter(OrganizationContext organizationContext,
                                DashboardTeamsContext teamsContext,
                                TeamsService teamsService,
                                @ConfigProperty(name = "miot.auth.org-path-prefix",
                                        defaultValue = "/api/v1/orgs/") String orgPathPrefix) {
        this.organizationContext = organizationContext;
        this.teamsContext = teamsContext;
        this.teamsService = teamsService;
        this.orgPathPrefix = orgPathPrefix;
    }

    @ServerRequestFilter(priority = Priorities.USER + 10)
    public Uni<Response> filter(ContainerRequestContext requestContext) {
        String path = requestContext.getUriInfo().getPath();
        String slug = organizationContext.getOrganizationId();
        String email = organizationContext.getUserEmail();
        if (!isDashboardPath(path, orgPathPrefix) || slug == null || email == null) {
            return Uni.createFrom().nullItem();
        }
        return teamsService.teamsOf(slug, Caller.user(email))
                .invoke(teams -> teamsContext.setTeamIds(
                        teams.stream().map(team -> team.id().toString()).toList()))
                .onFailure().invoke(error -> LOG.warnf(error,
                        "Could not read the teams of %s for a dashboard request", email))
                .onFailure().recoverWithNull()
                .replaceWith((Response) null);
    }

    /** {@code /api/v1/orgs/{slug}/dashboard…}: the dashboards and everything around them. */
    static boolean isDashboardPath(String path, String orgPathPrefix) {
        if (path == null || !path.startsWith(orgPathPrefix)) {
            return false;
        }
        int slugEnd = path.indexOf('/', orgPathPrefix.length());
        return slugEnd > 0 && path.startsWith(DASHBOARD_SEGMENT, slugEnd);
    }
}
