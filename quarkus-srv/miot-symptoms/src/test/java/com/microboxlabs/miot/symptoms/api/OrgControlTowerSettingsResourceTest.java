package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService.SettingsRequest;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTowerSettingsStore;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.groups.UniAwait;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Members read the operator team, only owners save it, and the path's organization must be the session's. */
class OrgControlTowerSettingsResourceTest {

    private static final String ORG = "org-a";
    private static final Duration WAIT = Duration.ofSeconds(5);

    private TowerSettingsService settings;

    /** Owners pass; everyone else gets 403, as the real service does. */
    private static final class Roles extends OrganizationRoleService {
        private final boolean owner;

        Roles(boolean owner) {
            super(null, null);
            this.owner = owner;
        }

        @Override
        public Uni<Void> requireOwner(String organizationSlug) {
            return owner ? Uni.createFrom().voidItem() : Uni.createFrom().failure(new ForbiddenException());
        }
    }

    @BeforeEach
    void setUp() {
        settings = new TowerSettingsService(new InMemoryTowerSettingsStore(),
                new AuditService(new InMemoryAuditStore()));
    }

    private OrgControlTowerSettingsResource resource(boolean owner) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail(owner ? "owner@example.com" : "member@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode("tenant-a");
        return new OrgControlTowerSettingsResource(tenant, org, new Roles(owner), null, settings);
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    @Test
    void membersReadButOnlyOwnersSave() {
        OrgControlTowerSettingsResource member = resource(false);
        Response read = call(member.get(ORG));
        assertEquals(200, read.getStatus());
        assertNull(((TowerSettings) read.getEntity()).operators());

        UniAwait<Response> denied = member.save(ORG, new SettingsRequest(3, 8, 150)).await();
        assertThrows(ForbiddenException.class, () -> denied.atMost(WAIT));
        assertNull(settings.get("tenant-a").operators(), "nothing was saved");

        Response saved = call(resource(true).save(ORG, new SettingsRequest(3, 8, 150)));
        assertEquals(200, saved.getStatus());
        assertEquals(3, ((TowerSettings) call(member.get(ORG)).getEntity()).operators());
        assertEquals("owner@example.com", settings.get("tenant-a").updatedBy());
    }

    @Test
    void invalidValuesAre400() {
        assertEquals(400, call(resource(true).save(ORG, new SettingsRequest(1, 0, 1))).getStatus());
        assertEquals(400, call(resource(true).save(ORG, null)).getStatus());
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        OrgControlTowerSettingsResource owner = resource(true);
        WebApplicationException e = assertThrows(WebApplicationException.class, () -> owner.get("org-b"));
        assertEquals(403, e.getResponse().getStatus());
        SettingsRequest team = new SettingsRequest(1, 8, 1);
        WebApplicationException w = assertThrows(WebApplicationException.class, () -> owner.save("org-b", team));
        assertEquals(403, w.getResponse().getStatus());
    }
}
