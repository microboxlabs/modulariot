package com.microboxlabs.miot.core.api;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import org.junit.jupiter.api.Test;

/**
 * The org → scope mapping, on its own.
 *
 * <p>Deliberately not a {@code @QuarkusTest}: the rest of the proxy is
 * pass-through and is covered by {@link DashboardProxyResourceTest}, which
 * needs a container. This is the one decision in the class, so it is worth
 * being able to run it anywhere.
 */
class DashboardScopeMappingTest {

    private static final String DEFAULT_SCOPE = "default";

    @Test
    void aSiteGroupNamesTheScope() {
        assertThat(DashboardProxyResource.scopeIdFrom("GROUP_site_fleet-ops", DEFAULT_SCOPE),
                is("fleet-ops"));
    }

    @Test
    void aPlainGroupFallsBackToTheDefault() {
        assertThat(DashboardProxyResource.scopeIdFrom("GROUP_operations", DEFAULT_SCOPE),
                is(DEFAULT_SCOPE));
    }

    @Test
    void noGroupAtAllFallsBackToTheDefault() {
        // The membership filter lets an org through when alfrescoGroupId is
        // null, so this reaches the mapping rather than being unreachable.
        assertThat(DashboardProxyResource.scopeIdFrom(null, DEFAULT_SCOPE), is(DEFAULT_SCOPE));
    }

    @Test
    void aSiteGroupPrefixWithNothingAfterItFallsBackRatherThanNamingAnEmptyScope() {
        // "GROUP_site_" alone would otherwise produce an empty scope id, which
        // the upstream refuses as an undecodable segment — a 400 that would
        // read as a broken proxy rather than a misconfigured org.
        assertThat(DashboardProxyResource.scopeIdFrom("GROUP_site_", DEFAULT_SCOPE),
                is(DEFAULT_SCOPE));
    }

    @Test
    void theSiteIdIsPassedThroughUntouched() {
        // Only the prefix is stripped. The upstream refuses a segment that is
        // exactly "." or ".."; anything else is the site's own name and this
        // must not rewrite it.
        assertThat(DashboardProxyResource.scopeIdFrom("GROUP_site_a.b", DEFAULT_SCOPE),
                is("a.b"));
    }
}
