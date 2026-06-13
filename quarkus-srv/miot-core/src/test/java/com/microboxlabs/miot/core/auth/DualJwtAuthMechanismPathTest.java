package com.microboxlabs.miot.core.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * {@link DualJwtAuthMechanism#templateToPattern} must match org-scoped resource
 * paths whose {@code @Path} contains a template variable in the middle — the
 * case that routes the integration-jobs API to HS256/M2M verification.
 */
class DualJwtAuthMechanismPathTest {

    @Test
    void templatedOrgPathMatchesRealPathAndSubPaths() {
        Pattern p = DualJwtAuthMechanism.templateToPattern(
                "/api/v1/orgs/{organizationId}/integrations/jobs");

        assertTrue(p.matcher("/api/v1/orgs/mintral/integrations/jobs").matches());
        assertTrue(p.matcher("/api/v1/orgs/mintral/integrations/jobs/enqueue").matches());
        assertTrue(p.matcher("/api/v1/orgs/acme-corp/integrations/jobs/claim").matches());
        assertTrue(p.matcher("/api/v1/orgs/acme/integrations/jobs/abc-123/report").matches());
    }

    @Test
    void templatedOrgPathRejectsOtherOrgEndpointsAndPartialSegments() {
        Pattern p = DualJwtAuthMechanism.templateToPattern(
                "/api/v1/orgs/{organizationId}/integrations/jobs");

        // A different org-scoped resource must stay on the RS256 (web) branch.
        assertFalse(p.matcher("/api/v1/orgs/mintral/calendar").matches());
        assertFalse(p.matcher("/api/v1/orgs/mintral/integrations/connections").matches());
        // The org segment is a single path segment, not a wildcard across slashes.
        assertFalse(p.matcher("/api/v1/orgs/a/b/integrations/jobs").matches());
        // No false prefix match without a slash boundary.
        assertFalse(p.matcher("/api/v1/orgs/mintral/integrations/jobsX").matches());
    }

    @Test
    void staticPathKeepsExactOrPrefixSemantics() {
        Pattern p = DualJwtAuthMechanism.templateToPattern("/api/v1/asset/track");

        assertTrue(p.matcher("/api/v1/asset/track").matches());
        assertTrue(p.matcher("/api/v1/asset/track/batch").matches());
        assertFalse(p.matcher("/api/v1/asset/tracking").matches());
    }
}
