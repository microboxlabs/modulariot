package com.microboxlabs.miot.core.auth;

import io.quarkus.test.junit.QuarkusTestProfile;
import java.util.HashMap;
import java.util.Map;

/**
 * Mirrors the deployed auth and datasource configuration for the platform-scope
 * endpoints — branding and roles. {@code miot-core} has no
 * {@code application.properties} of its own, so without these overrides
 * {@code /api/*} would be permit-all and the unauthenticated/forbidden split
 * under test would never fire.
 *
 * <p>Shared by every platform {@code @QuarkusTest} on purpose: one profile is
 * one application start.
 */
public class PlatformTestProfile implements QuarkusTestProfile {

    public static final String OWNER_EMAIL = "owner@test.example";
    public static final String NON_OWNER_EMAIL = "stranger@test.example";
    /**
     * Granted the role through the API rather than configuration. Kept distinct
     * from {@link #NON_OWNER_EMAIL} because the profile is shared: one test
     * class granting the other's "stranger" would silently turn its
     * forbidden-write assertions green.
     */
    public static final String GRANTED_EMAIL = "granted@test.example";

    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = new HashMap<>();

        overrides.put("miot.auth.rs256-issuer", TestTokenFactory.ISSUER);
        overrides.put("miot.auth.rs256-audience", TestTokenFactory.WEB_AUDIENCE);
        overrides.put("miot.auth.jwks-url",
                "http://localhost:${quarkus.http.test-port:8081}/_test/oidc/jwks");
        overrides.put("miot.auth.hs256-issuer", TestTokenFactory.ISSUER);
        overrides.put("miot.auth.hs256-secret", TestTokenFactory.HS256_SECRET);
        overrides.put("miot.auth.hs256-audience", TestTokenFactory.M2M_AUDIENCE);

        overrides.put("miot.platform.owner-emails", OWNER_EMAIL);

        overrides.put("miot.alfresco.auth", "stub");
        overrides.put("quarkus.arc.exclude-types",
                "com.microboxlabs.miot.core.alfresco.RealAlfrescoDirectoryClient,"
                        + "com.microboxlabs.miot.core.alfresco.RealAlfrescoGroupAdminClient,"
                        + "com.microboxlabs.miot.core.alfresco.RealAlfrescoMembershipClient");

        overrides.put("quarkus.http.auth.permission.api.paths", "/api/*");
        overrides.put("quarkus.http.auth.permission.api.policy", "authenticated");
        overrides.put("quarkus.http.auth.permission.public.paths", "/_test/*,/q/*");
        overrides.put("quarkus.http.auth.permission.public.policy", "permit");
        overrides.put("quarkus.http.auth.permission.branding.paths", "/branding/*");
        overrides.put("quarkus.http.auth.permission.branding.policy", "permit");

        overrides.put("quarkus.datasource.db-kind", "postgresql");
        overrides.put("quarkus.flyway.migrate-at-start", "true");
        overrides.put("quarkus.flyway.locations", "db/migration/core");
        overrides.put("quarkus.flyway.schemas", "miot_core");
        overrides.put("quarkus.flyway.create-schemas", "true");
        overrides.put("quarkus.hibernate-orm.schema-management.strategy", "none");
        overrides.put("quarkus.hibernate-orm.physical-naming-strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");

        return overrides;
    }
}
