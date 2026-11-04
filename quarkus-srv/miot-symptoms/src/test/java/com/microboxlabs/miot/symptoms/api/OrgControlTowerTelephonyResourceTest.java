package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.telephony.Telephony;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.TelephonyChoiceService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.WebApplicationException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrgControlTowerTelephonyResourceTest {
    private String issuedTo;

    private OrgControlTowerTelephonyResource resource(String email) {
        OrganizationContext organization = new OrganizationContext();
        organization.setOrganizationId("org-a");
        organization.setUserEmail(email);
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode("acme");
        tenant.setClientId("shared-service");
        Telephony provider = new Telephony() {
            @Override
            public List<TelephonyLine> lines(String tenantCode) {
                assertEquals("acme", tenantCode);
                return List.of(new TelephonyLine("conn", TelephonyProvider.TELNYX, "Line", "+56911111111", true));
            }

            @Override
            public WebRtcToken webRtcToken(String tenantCode, String connectionId, String operator) {
                assertEquals("acme", tenantCode);
                issuedTo = operator;
                return new WebRtcToken("placeholder", "+56911111111", Instant.now().plusSeconds(60));
            }
        };
        var service = new TelephonyChoiceService(new InMemoryTowerSettingsStore(), provider,
                new AuditService(new InMemoryAuditStore()));
        return new OrgControlTowerTelephonyResource(tenant, organization, null, null, service);
    }

    @Test
    void issuesOnlyForTheSignedInOperatorAndDoesNotCacheTheToken() {
        var response = resource("Ana@example.com").webRtcToken("org-a").await().atMost(Duration.ofSeconds(5));
        assertEquals(200, response.getStatus());
        assertEquals("ana@example.com", issuedTo);
        assertEquals("no-store", response.getHeaderString("Cache-Control"));
    }

    @Test
    void rejectsTheSharedServiceIdentityBeforeIssuingALogin() {
        assertThrows(ForbiddenException.class, () -> resource(null).webRtcToken("org-a"));
        assertNull(issuedTo);
    }

    @Test
    void rejectsAnOrganizationOutsideTheRequestContext() {
        var resource = resource("ana@example.com");
        assertThrows(WebApplicationException.class, () -> resource.webRtcToken("other-org"));
        assertNull(issuedTo);
    }
}
