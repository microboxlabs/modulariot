package com.microboxlabs.miot.core.api;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

/**
 * The Alfresco role → dashboard role mapping, on its own.
 *
 * <p>The four canonical site roles come from
 * {@code RealAlfrescoMembershipClient.toCanonicalSiteRole}, and the four
 * dashboard roles from the contract package. Anything else has to land on
 * {@code Consumer}: the membership filter has already established that the
 * caller is a member, so the only open question is how much they may do, and
 * an unrecognised role must answer "the least".
 */
class DashboardRoleMappingTest {

    @Test
    void siteManagerBecomesCoordinator() {
        assertThat(DashboardProxyResource.dashboardRoleFrom("SITE_MANAGER"),
                is("Coordinator"));
    }

    @Test
    void siteCollaboratorBecomesEditor() {
        assertThat(DashboardProxyResource.dashboardRoleFrom("SITE_COLLABORATOR"),
                is("Editor"));
    }

    @Test
    void siteContributorBecomesContributor() {
        assertThat(DashboardProxyResource.dashboardRoleFrom("SITE_CONTRIBUTOR"),
                is("Contributor"));
    }

    @Test
    void siteConsumerBecomesConsumer() {
        assertThat(DashboardProxyResource.dashboardRoleFrom("SITE_CONSUMER"),
                is("Consumer"));
    }

    /**
     * {@code GROUP_MEMBER} is what the membership client returns for an org
     * whose group is not a site. A null role is what the filter allows for an
     * org with no group at all. Neither says anything about editing.
     */
    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"GROUP_MEMBER", "SiteManager", "", "OWNER", "unknown"})
    void everythingElseBecomesConsumer(String role) {
        assertThat(DashboardProxyResource.dashboardRoleFrom(role), is("Consumer"));
    }
}
