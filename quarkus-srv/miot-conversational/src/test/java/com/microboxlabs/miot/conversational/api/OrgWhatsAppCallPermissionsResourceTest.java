package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.telephony.NoTelephony;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

class OrgWhatsAppCallPermissionsResourceTest {

    private static final String ORG = "org-a";
    private static final String TENANT = "tenant-a";
    private static final String PHONE = "+12025550101";
    private static final String ACTOR = "operator@example.test";
    private final List<String> permissionAccess = new ArrayList<>();
    private final List<String> eligibilityChecks = new ArrayList<>();
    private boolean eligible;

    private final CallPermissionService permissions = new CallPermissionService(null, key -> Optional.empty(),
            (tenant, to) -> null, (tenant, number, to, name, language, params) -> null, false, Clock.systemUTC()) {
        @Override
        public CallPermissionService forManagedCalls() {
            permissionAccess.add("managed");
            return this;
        }

        @Override
        public View view(String tenant, String phone) {
            assertEquals(PHONE, phone);
            permissionAccess.add("view:" + tenant);
            return new View(false, null, null, null, null, false, null, null);
        }

        @Override
        public RequestResult request(String tenant, String phone, String name, String actor) {
            assertEquals(PHONE, phone);
            assertEquals(ACTOR, actor);
            permissionAccess.add("request:" + tenant);
            return new RequestResult(false, null, null, null, null);
        }
    };

    private OrgWhatsAppCallPermissionsResource resource() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail(ACTOR);
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode(TENANT);
        return new OrgWhatsAppCallPermissionsResource(tenant, org, null, null, permissions, new NoTelephony() {
            @Override
            public boolean whatsAppCalling(String tenantCode) {
                eligibilityChecks.add(tenantCode);
                return eligible;
            }
        });
    }

    private void checkBothEndpoints(boolean managed, int status) {
        var resource = resource();
        try (Response read = resource.get(ORG, PHONE, managed).await().atMost(Duration.ofSeconds(5));
                Response request = resource.request(ORG, managed,
                        new OrgWhatsAppCallPermissionsResource.RequestBody(PHONE, "Test contact"))
                        .await().atMost(Duration.ofSeconds(5))) {
            assertEquals(status, read.getStatus());
            assertEquals(status, request.getStatus());
        }
    }

    @Test
    void ineligibleOrganizationsCannotReadSharedPermissionsOrConsumeRequestLimits() {
        checkBothEndpoints(true, 403);
        assertEquals(List.of(TENANT, TENANT), eligibilityChecks);
        assertTrue(permissionAccess.isEmpty(), "reject before accessing the platform sender or permission store");
    }

    @Test
    void eligibleOrganizationsUseManagedPermissionsWithTheirOwnTenantAttribution() {
        eligible = true;
        checkBothEndpoints(true, 200);
        assertEquals(List.of(TENANT, TENANT), eligibilityChecks);
        assertEquals(List.of("managed", "view:" + TENANT, "managed", "request:" + TENANT), permissionAccess);
    }

    @Test
    void normalSenderModeDoesNotDependOnManagedCallingEligibility() {
        checkBothEndpoints(false, 200);
        assertTrue(eligibilityChecks.isEmpty());
        assertEquals(List.of("view:" + TENANT, "request:" + TENANT), permissionAccess);
    }

    @Test
    void anotherOrganizationCannotUseTheResolvedTenant() {
        var resource = resource();
        assertThrows(WebApplicationException.class, () -> resource.get("other-org", PHONE, true));
        assertThrows(WebApplicationException.class, () -> resource.request("other-org", true, null));
        assertTrue(eligibilityChecks.isEmpty());
        assertTrue(permissionAccess.isEmpty());
    }
}
