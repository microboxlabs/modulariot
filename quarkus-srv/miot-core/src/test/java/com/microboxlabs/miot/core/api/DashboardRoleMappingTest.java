package com.microboxlabs.miot.core.api;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

/** The base role → dashboard role mapping, on its own. */
class DashboardRoleMappingTest {

    @Test
    void ownerIsCoordinatorAndAdminIsEditor() {
        assertThat(DashboardProxySupport.dashboardRoleFrom("OWNER"), is("Coordinator"));
        assertThat(DashboardProxySupport.dashboardRoleFrom("ADMIN"), is("Editor"));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"MEMBER", "SITE_MANAGER", "", "unknown"})
    void everythingElseIsConsumer(String role) {
        assertThat(DashboardProxySupport.dashboardRoleFrom(role), is("Consumer"));
    }
}
