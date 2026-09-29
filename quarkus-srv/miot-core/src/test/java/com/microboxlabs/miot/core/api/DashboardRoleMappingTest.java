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
 * dashboard roles from the contract package. Anything else maps to
 * {@code Consumer}, the lowest of the four.
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
     * The membership client returns {@code GROUP_MEMBER} for an org whose
     * group is not a site. The filter allows a null role for an org with no
     * group. Neither says anything about editing.
     */
    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"GROUP_MEMBER", "SiteManager", "", "OWNER", "unknown"})
    void everythingElseBecomesConsumer(String role) {
        assertThat(DashboardProxyResource.dashboardRoleFrom(role), is("Consumer"));
    }
}
