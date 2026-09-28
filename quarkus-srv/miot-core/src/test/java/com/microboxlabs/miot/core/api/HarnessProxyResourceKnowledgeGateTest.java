package com.microboxlabs.miot.core.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationPermissionDefinition;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.Vertx;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The knowledge-card proxy routes only reach the harness for trainers. */
class HarnessProxyResourceKnowledgeGateTest {

    private static final String SLUG = "org-a";

    private Vertx vertx;
    private final List<String> harnessCalls = new ArrayList<>();

    @BeforeEach
    void startVertx() {
        vertx = Vertx.vertx();
    }

    @AfterEach
    void stopVertx() {
        vertx.closeAndAwait();
    }

    @Test
    void nonTrainersCannotWriteListOrDeleteCards() {
        var resource = resource(false);
        Uni<Response> write = resource.writeConnectionKnowledge(SLUG, "conn", "Bearer t", Map.of());
        Uni<Response> list = resource.listConnectionKnowledge(SLUG, "conn", "Bearer t");
        Uni<Response> delete = resource.deleteConnectionKnowledge(SLUG, "conn", "card", "Bearer t");

        assertThrows(ForbiddenException.class, () -> write.await().indefinitely());
        assertThrows(ForbiddenException.class, () -> list.await().indefinitely());
        assertThrows(ForbiddenException.class, () -> delete.await().indefinitely());
        assertTrue(harnessCalls.isEmpty());
    }

    @Test
    void trainersReachTheHarness() {
        var resource = resource(true);

        assertEquals(200, resource.listConnectionKnowledge(SLUG, "conn", "Bearer t")
                .await().indefinitely().getStatus());
        assertEquals(200, resource.deleteConnectionKnowledge(SLUG, "conn", "card", "Bearer t")
                .await().indefinitely().getStatus());
        assertEquals(200, resource.writeConnectionKnowledge(SLUG, "conn", "Bearer t", Map.of())
                .await().indefinitely().getStatus());
        assertEquals(List.of("listConnectionKnowledge", "deleteConnectionKnowledge",
                "writeConnectionKnowledge"), harnessCalls);
    }

    private HarnessProxyResource resource(boolean trainer) {
        HarnessClient harness = (HarnessClient) Proxy.newProxyInstance(
                HarnessClient.class.getClassLoader(),
                new Class<?>[] {HarnessClient.class},
                (proxy, method, args) -> {
                    harnessCalls.add(method.getName());
                    return Uni.createFrom().item(Response.ok().build());
                });
        var organization = new OrganizationContext();
        organization.setUserEmail("person@example.com");
        return new HarnessProxyResource(harness, new TenantContext(), organization, null,
                new FixedPermissionService(trainer), vertx, "http://harness");
    }

    private static final class FixedPermissionService extends OrganizationPermissionService {
        private final boolean allowed;

        FixedPermissionService(boolean allowed) {
            super(null, null);
            this.allowed = allowed;
        }

        @Override
        public Uni<Void> requirePermission(
                String organizationSlug, OrganizationPermissionDefinition permission) {
            return allowed
                    ? Uni.createFrom().voidItem()
                    : Uni.createFrom().failure(new ForbiddenException("trainer required"));
        }
    }
}
