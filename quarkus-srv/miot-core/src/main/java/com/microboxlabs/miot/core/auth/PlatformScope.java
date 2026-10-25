package com.microboxlabs.miot.core.auth;

import java.util.List;

/**
 * The platform as a scope, like an organization: platform owners call {@code /api/v1/orgs/_platform/...} for the
 * settings the platform has too, and the request runs under tenant {@value #TENANT}. Slugs starting with "_" are
 * reserved; no organization can take one. Only the org resources in {@link #SUPPORTED} serve the platform scope;
 * the others need a real organization.
 */
public final class PlatformScope {

    public static final String SLUG = "_platform";
    /** The tenant of the platform's own data, the same as the slug. */
    public static final String TENANT = SLUG;
    /** The scope's organization id; organization ids are positive. */
    public static final long ORGANIZATION_ID = -1L;
    public static final String DISPLAY_NAME = "Plataforma";
    public static final String ROLE = "PLATFORM_OWNER";

    /** The paths after {@code /api/v1/orgs/_platform/} that serve the platform scope, and their sub-paths. */
    static final List<String> SUPPORTED = List.of(
            "me/access",
            "integrations/connections",
            "integrations/credential-profiles",
            "integrations/templates",
            "integrations/console/jobs",
            "integrations/console/notification-rules",
            "conversations",
            "control-tower/access",
            "control-tower/symptom-definitions",
            "control-tower/symptom-families",
            "control-tower/data-sources");

    private PlatformScope() {
    }

    /** A slug no organization may take. */
    public static boolean reserved(String slug) {
        return slug != null && slug.startsWith("_");
    }

    public static boolean isPlatform(String slug) {
        return SLUG.equals(slug);
    }

    /** Whether the resource at {@code path}, the path after the slug, serves the platform scope. */
    static boolean supports(String path) {
        String rest = path == null ? "" : path.replaceAll("^/+", "");
        return SUPPORTED.stream().anyMatch(p -> rest.equals(p) || rest.startsWith(p + "/"));
    }
}
