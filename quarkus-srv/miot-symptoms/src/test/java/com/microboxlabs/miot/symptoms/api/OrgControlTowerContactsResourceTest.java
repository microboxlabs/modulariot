package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.event.ContactConditions;
import com.microboxlabs.miot.symptoms.dto.TripContactsRequest;
import jakarta.enterprise.inject.Instance;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrgControlTowerContactsResourceTest {

    @Test
    void tripContactsAreUnavailableWithoutTheConversationalComponent() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId("org-test");
        TenantContext tenant = new TenantContext();
        tenant.setClientId("tenant-test");
        var resource = new OrgControlTowerContactsResource(tenant, org, null, null, null, null, unavailable(), null);

        var response = resource.trip("org-test", new TripContactsRequest("-1", List.of("true")))
                .await().atMost(Duration.ofSeconds(5));

        assertEquals(503, response.getStatus());
    }

    @SuppressWarnings("unchecked")
    private static Instance<ContactConditions> unavailable() {
        return (Instance<ContactConditions>) Proxy.newProxyInstance(
                OrgControlTowerContactsResourceTest.class.getClassLoader(), new Class<?>[] {Instance.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "isResolvable" -> false;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }
}
