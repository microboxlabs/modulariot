package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.UpdateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.PlatformOnlyCredentialException;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class OrgCredentialProfilesResourceTest {

    @ParameterizedTest
    @ValueSource(strings = {"mapbox", "google_maps"})
    void returnsForbiddenForPlatformOnlyCreationAndRetagging(String provider) {
        var failure = new PlatformOnlyCredentialException(provider);
        var resource = resource(failure);
        assertError(resource.create("org", null).await().indefinitely(), 403, failure.getMessage());
        assertError(resource.update("org", "credential", null).await().indefinitely(), 403, failure.getMessage());
    }

    @Test
    void otherValidationFailuresRemainBadRequests() {
        var resource = resource(new IllegalArgumentException("displayName is required"));
        assertError(resource.create("org", null).await().indefinitely(), 400, "displayName is required");
        assertError(resource.update("org", "credential", null).await().indefinitely(), 400, "displayName is required");
    }

    private static void assertError(Response response, int status, String message) {
        assertEquals(status, response.getStatus());
        assertEquals(Map.of("error", message), response.getEntity());
    }

    private static OrgCredentialProfilesResource resource(IllegalArgumentException failure) {
        var tenant = new TenantContext();
        tenant.setTenantCode("tenant-1");
        var organization = new OrganizationContext();
        organization.setOrganizationId("org");
        organization.setUserEmail("owner@example.test");
        var roles = new OrganizationRoleService(organization, null, null) {
            @Override
            public Uni<Void> requireOwner(String organizationSlug) {
                return Uni.createFrom().voidItem();
            }
        };
        var service = new CredentialProfileService(null, null, null, null) {
            @Override
            public CredentialProfileResponse create(String tenantCode, String actor, CreateCredentialProfileRequest req) {
                throw failure;
            }

            @Override
            public CredentialProfileResponse update(
                    String tenantCode, String actor, String id, UpdateCredentialProfileRequest req) {
                throw failure;
            }
        };
        return new OrgCredentialProfilesResource(tenant, organization, roles, service);
    }
}
