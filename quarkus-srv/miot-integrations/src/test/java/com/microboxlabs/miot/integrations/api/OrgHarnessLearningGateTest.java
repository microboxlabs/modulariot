package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationPermissionDefinition;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import com.microboxlabs.miot.integrations.dto.ThreadResponse;
import com.microboxlabs.miot.integrations.dto.ThreadUpsertRequest;
import com.microboxlabs.miot.integrations.dto.TranscriptDtos.Transcript;
import com.microboxlabs.miot.integrations.service.HarnessThreadService;
import com.microboxlabs.miot.integrations.service.HarnessTranscriptService;
import com.microboxlabs.miot.integrations.service.InMemoryStories;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Learning threads and transcripts are for trainers only. */
class OrgHarnessLearningGateTest {

    private static final String ORG = "acme";
    private static final String TENANT = "tenant-1";
    private static final String EMAIL = "person@example.test";

    private final List<String> created = new ArrayList<>();
    private final List<OrganizationPermissionDefinition> checked = new ArrayList<>();

    @Test
    void onlyTrainersCreateLearningThreads() {
        String id = UUID.randomUUID().toString();
        var learning = new ThreadUpsertRequest(id, "session", null, "learning");

        assertThrows(ForbiddenException.class,
                () -> threads(false).createThread(ORG, learning).await().indefinitely());
        assertTrue(created.isEmpty());

        assertEquals(201, threads(true).createThread(ORG, learning).await().indefinitely().getStatus());
        assertEquals(List.of("learning"), created);
        assertEquals(List.of(OrganizationPermissionDefinition.HARNESS_TRAINER,
                OrganizationPermissionDefinition.HARNESS_TRAINER), checked);
    }

    @Test
    void chatThreadsNeedNoTrainer() {
        var chat = new ThreadUpsertRequest(UUID.randomUUID().toString(), "chat", null);

        assertEquals(201, threads(false).createThread(ORG, chat).await().indefinitely().getStatus());
        assertEquals(List.of("chat"), created);
        assertTrue(checked.isEmpty());
    }

    @Test
    void onlyTrainersReadTranscripts() {
        var store = new InMemoryStories();
        String id = UUID.randomUUID().toString();
        store.threads.add(id, TENANT, "someone@example.test", "Trips");
        store.threads.addMessage(id, "m1");
        var service = new HarnessTranscriptService(store.threads, store.links);

        assertThrows(ForbiddenException.class,
                () -> transcripts(service, false).transcript(ORG, id).await().indefinitely());

        var response = transcripts(service, true).transcript(ORG, id).await().indefinitely();
        assertEquals(200, response.getStatus());
        assertEquals(id, ((Transcript) response.getEntity()).threadId());
        assertEquals(404, transcripts(service, true)
                .transcript(ORG, UUID.randomUUID().toString()).await().indefinitely().getStatus());
    }

    private OrgHarnessThreadsResource threads(boolean trainer) {
        var service = new HarnessThreadService(null) {
            @Override
            public ThreadResponse create(String tenantCode, String userId, ThreadUpsertRequest request) {
                String kind = HarnessThreadService.kind(request);
                created.add(kind);
                return new ThreadResponse(request.id(), request.title(), null, null, userId, true,
                        null, null, null, null, List.of(), false, kind);
            }
        };
        return new OrgHarnessThreadsResource(service, tenant(), organization(), null, permissions(trainer));
    }

    private OrgHarnessTranscriptsResource transcripts(HarnessTranscriptService service, boolean trainer) {
        return new OrgHarnessTranscriptsResource(service, permissions(trainer), tenant(), organization(), null);
    }

    private static TenantContext tenant() {
        var tenant = new TenantContext();
        tenant.setTenantCode(TENANT);
        return tenant;
    }

    private static OrganizationContext organization() {
        var organization = new OrganizationContext();
        organization.setOrganizationId(ORG);
        organization.setUserEmail(EMAIL);
        return organization;
    }

    private OrganizationPermissionService permissions(boolean allowed) {
        return new OrganizationPermissionService(null, null) {
            @Override
            public Uni<Void> requirePermission(
                    String organizationSlug, OrganizationPermissionDefinition permission) {
                checked.add(permission);
                return allowed
                        ? Uni.createFrom().voidItem()
                        : Uni.createFrom().failure(new ForbiddenException("trainer required"));
            }
        };
    }
}
