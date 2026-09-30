package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.ForkRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.PublishRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.RollbackRequest;
import com.microboxlabs.miot.symptoms.api.OrgSymptomDefinitionsResource.StateRequest;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.IdentityRequest;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Who may call which endpoint, and that the path's organization must be the session's. */
class OrgSymptomDefinitionsResourceTest {

    private static final String ORG = "org-a";
    private static final Duration WAIT = Duration.ofSeconds(5);

    private SymptomCatalogService catalog;
    private String id;

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
        InMemoryCatalog store = new InMemoryCatalog();
        store.upsert(Specs.gpsSignal());
        catalog = new SymptomCatalogService(store, store, new AuditService(new InMemoryAuditStore()));
        id = catalog.create("tenant-a", "owner@example.com", new CreateRequest("speeding", "Exceso", null, null, null,
                "gps_signal", null, Specs.speeding())).definition().id().toString();
    }

    private OrgSymptomDefinitionsResource resource(boolean owner) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail(owner ? "owner@example.com" : "member@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode("tenant-a");
        return new OrgSymptomDefinitionsResource(tenant, org, new Roles(owner), null, catalog);
    }

    private static int status(Uni<Response> call) {
        return call.await().atMost(WAIT).getStatus();
    }

    @Test
    void membersReadButCannotWrite() {
        OrgSymptomDefinitionsResource member = resource(false);
        assertEquals(200, status(member.list(ORG)));
        assertEquals(200, status(member.get(ORG, id)));

        List<Supplier<Uni<Response>>> writes = List.of(
                () -> member.create(ORG, new CreateRequest("other", "Otro", null, null, null, "gps_signal", null, null)),
                () -> member.updateIdentity(ORG, id, new IdentityRequest("x", null, null, null)),
                () -> member.saveDraft(ORG, id, Specs.speeding()),
                () -> member.discardDraft(ORG, id),
                () -> member.publish(ORG, id, new PublishRequest("r", null, null)),
                () -> member.rollback(ORG, id, new RollbackRequest("1.0.0", null)),
                () -> member.fork(ORG, id, new ForkRequest(null, "copy", "Copia")),
                () -> member.setState(ORG, id, new StateRequest(SymptomState.OFF)));
        for (Supplier<Uni<Response>> write : writes) {
            Uni<Response> call = write.get();
            assertThrows(ForbiddenException.class, () -> call.await().atMost(WAIT));
        }
    }

    @Test
    void ownersPublishAndErrorsMapToStatusCodes() {
        OrgSymptomDefinitionsResource owner = resource(true);

        assertEquals(200, status(owner.publish(ORG, id, new PublishRequest("Primera", null, SymptomState.ACTIVE))));
        assertEquals(409, status(owner.publish(ORG, id, new PublishRequest("Otra", null, null))), "no draft left");
        assertEquals(400, status(owner.get(ORG, "not-a-uuid")));
        assertEquals(404, status(owner.get(ORG, "00000000-0000-0000-0000-000000000000")));
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        OrgSymptomDefinitionsResource owner = resource(true);

        WebApplicationException e = assertThrows(WebApplicationException.class, () -> owner.list("org-b"));
        assertEquals(403, e.getResponse().getStatus());
    }
}
