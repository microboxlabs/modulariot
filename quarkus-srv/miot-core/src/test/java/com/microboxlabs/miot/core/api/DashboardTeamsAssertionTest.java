package com.microboxlabs.miot.core.api;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
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

    @Test
    void exactlyTwoHundredTeamsAreAsserted() {
        List<String> teamIds = IntStream.range(0, 200).mapToObj(Integer::toString).toList();

        String groups = DashboardProxySupport.groupsHeader(teamIds);

        assertThat(groups, is(String.join(",", teamIds.stream().map(id -> "team:" + id).toList())));
    }

    @Test
    void overflowingTeamsDoNotRemoveTheOtherAssertions() {
        var organization = new OrganizationContext();
        organization.setUserEmail("member@example.test");
        organization.setBaseRole("ADMIN");
        var teams = new DashboardTeamsContext();
        teams.setTeamIds(IntStream.range(0, 201).mapToObj(Integer::toString).toList());
        var support = new DashboardProxySupport(organization, teams, "default", Optional.of("proxy-key"));

        DashboardAssertion assertion = support.assertionFor("acme", "Bearer verified-token");

        assertThat(assertion.groups, is(nullValue()));
        assertThat(assertion.proxyKey, is("proxy-key"));
        assertThat(assertion.user, is("member@example.test"));
        assertThat(assertion.tenant, is("acme"));
        assertThat(assertion.scope, is("default"));
        assertThat(assertion.role, is("Editor"));
    }
}
