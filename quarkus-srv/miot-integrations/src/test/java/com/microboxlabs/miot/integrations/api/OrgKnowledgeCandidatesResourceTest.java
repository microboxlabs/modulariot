package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationPermissionDefinition;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import com.microboxlabs.miot.integrations.dto.CandidateEditRequest;
import com.microboxlabs.miot.integrations.dto.CandidateRequest;
import com.microboxlabs.miot.integrations.persistence.KnowledgeCandidateRepository;
import com.microboxlabs.miot.integrations.service.CandidateService;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Reviewing and editing candidates needs HARNESS_TRAINER; staging one does not. */
class OrgKnowledgeCandidatesResourceTest {

    private static final String ORG = "org-a";
    private static final String ID = "00000000-0000-0000-0000-000000000001";

    private final FakeRepository repository = new FakeRepository();

    @Test
    void nonTrainersCannotApproveRejectOrEdit() {
        var resource = resource(false);
        var approve = resource.approve(ORG, ID);
        var reject = resource.reject(ORG, ID);
        var edit = resource.edit(ORG, ID, new CandidateEditRequest("term", "body"));

        assertThrows(ForbiddenException.class, () -> approve.await().indefinitely());
        assertThrows(ForbiddenException.class, () -> reject.await().indefinitely());
        assertThrows(ForbiddenException.class, () -> edit.await().indefinitely());
        assertTrue(repository.calls.isEmpty());
    }

    @Test
    void anyMemberCanStageACandidate() {
        var resource = resource(false);
        var request = new CandidateRequest("conn", "term", null, null, null, "body", null);

        Response response = resource.create(ORG, request).await().indefinitely();

        assertEquals(201, response.getStatus());
        assertEquals(List.of("insert"), repository.calls);
    }

    @Test
    void trainersApproveAndEditPendingCandidates() {
        var resource = resource(true);

        assertEquals(200, resource.approve(ORG, ID).await().indefinitely().getStatus());
        Response edited = resource.edit(ORG, ID, new CandidateEditRequest("new term", "new body"))
                .await().indefinitely();

        assertEquals(200, edited.getStatus());
        assertEquals(List.of("updateStatus:approved", "updateContent:new term:new body"),
                repository.calls);
    }

    @Test
    void editValidatesLikeCreateAndMapsMissingTo404() {
        var resource = resource(true);

        Response blank = resource.edit(ORG, ID, new CandidateEditRequest(" ", "body"))
                .await().indefinitely();
        assertEquals(400, blank.getStatus());

        repository.result = null;
        Response missing = resource.edit(ORG, ID, new CandidateEditRequest("term", "body"))
                .await().indefinitely();
        assertEquals(404, missing.getStatus());
    }

    private OrgKnowledgeCandidatesResource resource(boolean trainer) {
        var organization = new OrganizationContext();
        organization.setOrganizationId(ORG);
        var tenant = new TenantContext();
        tenant.setTenantCode("tenant-a");
        return new OrgKnowledgeCandidatesResource(
                new CandidateService(repository), tenant, organization, null,
                new FixedPermissionService(trainer));
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
            return allowed && permission == OrganizationPermissionDefinition.HARNESS_TRAINER
                    ? Uni.createFrom().voidItem()
                    : Uni.createFrom().failure(new ForbiddenException("trainer required"));
        }
    }

    private static final class FakeRepository extends KnowledgeCandidateRepository {
        final List<String> calls = new ArrayList<>();
        KnowledgeCandidate result = new KnowledgeCandidate(
                ID, "tenant-a", "conn", "term", null, "tenant", null, "body",
                Map.of(), "pending", "u", null, null, null);

        FakeRepository() {
            super(null);
        }

        @Override
        public KnowledgeCandidate insert(KnowledgeCandidate candidate) {
            calls.add("insert");
            return candidate;
        }

        @Override
        public KnowledgeCandidate updateStatus(
                String tenantCode, String id, String status, String reviewedBy) {
            calls.add("updateStatus:" + status);
            return result;
        }

        @Override
        public KnowledgeCandidate updateContent(
                String tenantCode, String id, String term, String body) {
            calls.add("updateContent:" + term + ":" + body);
            return result;
        }
    }
}
