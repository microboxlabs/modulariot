package com.microboxlabs.miot.core.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.api.dto.AuthorizationDecisionDto;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.harness.HarnessPlanGate;
import com.microboxlabs.miot.core.permission.OrganizationPermissionDefinition;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.Vertx;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Run requests reach the harness with {@code trainer} set by the proxy, never by the caller. */
class HarnessProxyResourceTrainerFlagTest {

    private static final String SLUG = "org-a";

    private Vertx vertx;
    private final List<Map<String, Object>> bodies = new ArrayList<>();
    private final List<String> checkedPermissions = new ArrayList<>();

    @BeforeEach
    void startVertx() {
        vertx = Vertx.vertx();
    }

    @AfterEach
    void stopVertx() {
        vertx.closeAndAwait();
    }

    @Test
    void trainersStartRunsAsTrainers() {
        resource(Uni.createFrom().item(true))
                .startRun(SLUG, "runs:start", "Bearer t", Map.of("message", "hi"))
                .await().indefinitely();

        assertEquals(true, bodies.get(0).get("trainer"));
        assertEquals("hi", bodies.get(0).get("message"));
        assertEquals(List.of(OrganizationPermissionDefinition.HARNESS_TRAINER.permissionCode()),
                checkedPermissions);
    }

    @Test
    void aCallerCannotClaimToBeATrainer() {
        resource(Uni.createFrom().item(false))
                .createRun(SLUG, "Bearer t", Map.of("message", "hi", "trainer", true))
                .await().indefinitely();

        assertEquals(false, bodies.get(0).get("trainer"));
    }

    @Test
    void aFailedLookupStartsTheRunWithoutTrainer() {
        resource(Uni.createFrom().failure(new IllegalStateException("db down")))
                .startRun(SLUG, "runs:start", "Bearer t", null)
                .await().indefinitely();

        assertEquals(false, bodies.get(0).get("trainer"));
        assertEquals("default-model", bodies.get(0).get("model"));
    }

    @SuppressWarnings("unchecked")
    private HarnessProxyResource resource(Uni<Boolean> trainer) {
        HarnessClient harness = (HarnessClient) Proxy.newProxyInstance(
                HarnessClient.class.getClassLoader(),
                new Class<?>[] {HarnessClient.class},
                (proxy, method, args) -> {
                    bodies.add((Map<String, Object>) args[args.length - 1]);
                    return Uni.createFrom().item(Response.ok().build());
                });
        var organization = new OrganizationContext();
        organization.setUserEmail("person@example.com");
        return new HarnessProxyResource(harness, new TenantContext(), organization,
                new AllowingPlanGate(), new FixedPermissionService(trainer), vertx,
                "http://harness");
    }

    private final class FixedPermissionService extends OrganizationPermissionService {
        private final Uni<Boolean> allowed;

        FixedPermissionService(Uni<Boolean> allowed) {
            super(null, null);
            this.allowed = allowed;
        }

        @Override
        public Uni<AuthorizationDecisionDto> checkCurrentUser(
                String organizationSlug, String permissionCode) {
            checkedPermissions.add(permissionCode);
            return allowed.map(ok -> new AuthorizationDecisionDto(permissionCode, "p", ok));
        }
    }

    private static final class AllowingPlanGate implements HarnessPlanGate {
        @Override
        public Uni<String> defaultModel(String organization) {
            return Uni.createFrom().item("default-model");
        }

        @Override
        public Uni<Refusal> checkRun(String organization, String userEmail, String model) {
            return Uni.createFrom().nullItem();
        }

        @Override
        public Uni<Map<String, Object>> models(String organization, Map<String, Object> models) {
            return Uni.createFrom().item(models);
        }

        @Override
        public boolean changesModels() {
            return false;
        }
    }
}
