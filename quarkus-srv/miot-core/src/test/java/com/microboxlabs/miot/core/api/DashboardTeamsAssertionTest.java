package com.microboxlabs.miot.core.api;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Which requests look up the caller's teams, and how the teams are asserted.
 * Plain unit tests, like {@link DashboardScopeMappingTest}: the decisions run
 * anywhere, without a container.
 */
class DashboardTeamsAssertionTest {

    private static final String PREFIX = "/api/v1/orgs/";

    @Test
    void onlyTheDashboardPathsLookUpTeams() {
        assertThat(DashboardTeamsFilter.isDashboardPath("/api/v1/orgs/acme/dashboards", PREFIX), is(true));
        assertThat(DashboardTeamsFilter.isDashboardPath("/api/v1/orgs/acme/dashboards/fleet/star", PREFIX),
                is(true));
        assertThat(DashboardTeamsFilter.isDashboardPath("/api/v1/orgs/acme/dashboard-folders", PREFIX), is(true));
        assertThat(DashboardTeamsFilter.isDashboardPath("/api/v1/orgs/acme/fleet", PREFIX), is(false));
        assertThat(DashboardTeamsFilter.isDashboardPath("/api/v1/orgs/dashboards", PREFIX), is(false));
        assertThat(DashboardTeamsFilter.isDashboardPath("/api/v1/me/dashboards", PREFIX), is(false));
    }

    @Test
    void teamsAreAssertedAsTeamAuthorities() {
        assertThat(DashboardProxySupport.groupsHeader(List.of("a1", "b2")), is("team:a1,team:b2"));
        assertThat(DashboardProxySupport.groupsHeader(List.of()), is(nullValue()));
        assertThat(DashboardProxySupport.groupsHeader(null), is(nullValue()));
    }
}
