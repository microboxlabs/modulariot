package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.BindingPreviewResponse;
import com.microboxlabs.miot.integrations.dto.DispatchTargetResponse;
import com.microboxlabs.miot.integrations.dto.IntegrationEventBindingResponse;
import com.microboxlabs.miot.integrations.dto.UpsertIntegrationEventBindingRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.template.PayloadRenderer;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationEventBindingServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String PARENT_ORG = "gama";
    private static final String CHILD_ORG = "traza";
    private static final String ACTOR = "operator@example.com";
    private static final String CONNECTION_ID = "11111111-1111-1111-1111-111111111111";
    private static final String OPERATION_ID = "22222222-2222-2222-2222-222222222222";

    private final FakeBindings bindings = new FakeBindings();
    private final FakeConnections connections = new FakeConnections();
    private final FakeOperations operations = new FakeOperations();

    private IntegrationEventBindingService service() {
        return new IntegrationEventBindingService(
                bindings, connections, operations, new PayloadRenderer());
    }

    private static UpsertIntegrationEventBindingRequest request(Map<String, String> templates) {
        return new UpsertIntegrationEventBindingRequest(
                "review.verdict", "kanban_lane", "shipping:confirmCierre",
                CONNECTION_ID, OPERATION_ID, Map.of(), templates, Map.of(), null, null, true);
    }

    private static Map<String, String> validTemplates() {
        Map<String, String> templates = new LinkedHashMap<>();
        templates.put("guidMultimedia", "{{content.mediaId}}");
        templates.put("aprobado", "{{review.verdict}}");
        return templates;
    }

    /* ---- writes ---- */

    @Test
    void storesTheBindingStampedWithTheCallingOrgNotTheBody() {
        service().upsert(TENANT, CHILD_ORG, request(validTemplates()), ACTOR);

        IntegrationEventBinding stored = bindings.saved.get(0);
        assertEquals(CHILD_ORG, stored.ownerOrgSlug());
        assertEquals(TENANT, stored.tenantClientId());
        assertEquals("review.verdict", stored.eventType());
        assertEquals("kanban_lane", stored.scopeKind());
    }

    @Test
    void refusesABindingOnAConnectionThatHasNeverPassedItsTest() {
        connections.status = ConnectionStatus.DRAFT;

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG, request(validTemplates()), ACTOR));

        assertTrue(failure.getMessage().contains("DRAFT"), failure.getMessage());
        assertTrue(bindings.saved.isEmpty(), "nothing should be stored");
    }

    @Test
    void refusesAnOperationThatBelongsToAnotherConnection() {
        operations.operation = null;

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG, request(validTemplates()), ACTOR));

        assertTrue(failure.getMessage().contains("does not belong"), failure.getMessage());
    }

    @Test
    void requiresAnOperationForOperationBasedChannels() {
        var noOperation = new UpsertIntegrationEventBindingRequest(
                "review.verdict", null, null, CONNECTION_ID, null, Map.of(), validTemplates(), Map.of(), null, null, true);

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG, noOperation, ACTOR));

        assertTrue(failure.getMessage().contains("operationId"), failure.getMessage());
    }

    /** Enrichment bindings render over the job payload, not the review snapshot. */
    @Test
    void enrichmentBindingsMayReadTheJobPayloadRoots() {
        var enrichment = new UpsertIntegrationEventBindingRequest(
                "calendar.resource_enrichment", null, null, CONNECTION_ID, OPERATION_ID,
                Map.of(),
                Map.of("guidMultimedia", "{{resourceData.mintral_driver1Rut}}",
                        "aprobado", "{{resourceData.mintral_serviceKind}}"),
                Map.of("assignedDriver", "{{response.driver_id}}"),
                null, null, true);

        service().upsert(TENANT, CHILD_ORG, enrichment, ACTOR);

        assertEquals("{{resourceData.mintral_driver1Rut}}",
                bindings.saved.get(0).fieldTemplates().get("guidMultimedia"));
        assertEquals("{{response.driver_id}}",
                bindings.saved.get(0).responseTemplates().get("assignedDriver"));
    }

    @Test
    void assignmentBindingsMayReadTheDispatchContextRoots() {
        var assignment = new UpsertIntegrationEventBindingRequest(
                "calendar.resource_assignment", null, null, CONNECTION_ID, OPERATION_ID,
                Map.of(),
                Map.of("guidMultimedia", "{{service.code}}",
                        "aprobado", "{{resourceData.mintral_serviceKind}}"),
                Map.of(), null, null, true);

        service().upsert(TENANT, CHILD_ORG, assignment, ACTOR);

        assertEquals("{{service.code}}",
                bindings.saved.get(0).fieldTemplates().get("guidMultimedia"));
    }

    /** The release event shares the assignment's context vocabulary. */
    @Test
    void releaseBindingsMayReadTheDispatchContextRoots() {
        var release = new UpsertIntegrationEventBindingRequest(
                "calendar.resource_release", null, null, CONNECTION_ID, OPERATION_ID,
                Map.of(),
                Map.of("guidMultimedia", "{{service.code}}",
                        "aprobado", "{{resourceData.mintral_serviceKind}}"),
                Map.of(), null, null, true);

        service().upsert(TENANT, CHILD_ORG, release, ACTOR);

        assertEquals("{{service.code}}",
                bindings.saved.get(0).fieldTemplates().get("guidMultimedia"));
    }

    /** A review binding still cannot read job-payload roots — the roots are per event. */
    @Test
    void reviewBindingsStillCannotReadJobPayloadRoots() {
        var wrongRoot = new UpsertIntegrationEventBindingRequest(
                "review.verdict", null, null, CONNECTION_ID, OPERATION_ID,
                Map.of(),
                Map.of("guidMultimedia", "{{resourceData.mintral_driver1Rut}}",
                        "aprobado", "{{review.verdict}}"),
                Map.of(), null, null, true);

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG, wrongRoot, ACTOR));

        assertTrue(failure.getMessage().contains("resourceData"), failure.getMessage());
    }

    @Test
    void aWhatsAppBindingNeedsNoOperation() {
        connections.providerType = ProviderType.WHATSAPP;
        var noOperation = new UpsertIntegrationEventBindingRequest(
                "symptom.reported", "symptom_board", "b-1",
                CONNECTION_ID, null, Map.of(), Map.of("body", "{{task.serviceCode}}"), Map.of(), null, null, true);

        service().upsert(TENANT, CHILD_ORG, noOperation, ACTOR);

        assertNull(bindings.saved.get(0).operationId());
    }

    @Test
    void rejectsAMappingThatMissesARequiredField() {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG,
                        request(Map.of("aprobado", "{{review.verdict}}")), ACTOR));

        assertTrue(failure.getMessage().contains("guidMultimedia"), failure.getMessage());
    }

    @Test
    void rejectsATemplateTheUiWouldRenderDifferently() {
        Map<String, String> templates = validTemplates();
        templates.put("mensaje", "{{#if review.verdict}}ok{{/if}}");

        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG, request(templates), ACTOR));

        assertTrue(failure.getMessage().contains("mensaje"), failure.getMessage());
    }

    /* ---- field defaults and response conditions ---- */

    private static UpsertIntegrationEventBindingRequest requestWith(
            Map<String, String> fieldDefaults, Map<String, Object> responseConditions) {
        return new UpsertIntegrationEventBindingRequest(
                "review.verdict", "kanban_lane", "shipping:confirmCierre",
                CONNECTION_ID, OPERATION_ID, Map.of(), validTemplates(), Map.of(),
                fieldDefaults, responseConditions, true);
    }

    @Test
    void storesDefaultsAndResponseConditions() {
        var stored = service().upsert(TENANT, CHILD_ORG, requestWith(
                Map.of("guidMultimedia", "00000000-0"),
                Map.of("success", Map.of("response.code", "OK"))), ACTOR);

        assertEquals(Map.of("guidMultimedia", "00000000-0"), stored.fieldDefaults());
        assertEquals(Map.of("success", Map.of("response.code", "OK")), stored.responseConditions());
    }

    @Test
    void rejectsADefaultForAnUnmappedField() {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG,
                        requestWith(Map.of("unmapped", "x"), Map.of()), ACTOR));

        assertTrue(failure.getMessage().contains("unmapped"), failure.getMessage());
    }

    @Test
    void acceptsANullDefaultAsAnExplicitNull() {
        // Not an empty value: a JSON-null default declares that an empty render must send
        // "field": null — the clear signal merge-on-missing partners need.
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("guidMultimedia", null);

        var stored = service().upsert(TENANT, CHILD_ORG, requestWith(defaults, Map.of()), ACTOR);

        assertTrue(stored.fieldDefaults().containsKey("guidMultimedia"));
        assertNull(stored.fieldDefaults().get("guidMultimedia"));
    }

    @Test
    void rejectsABlankDefault() {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG,
                        requestWith(Map.of("guidMultimedia", "  "), Map.of()), ACTOR));

        assertTrue(failure.getMessage().contains("empty"), failure.getMessage());
    }

    @Test
    void rejectsResponseConditionsWithoutASuccessMatcher() {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG,
                        requestWith(Map.of(), Map.of("retry", Map.of("response.code", "AUTH"))), ACTOR));

        assertTrue(failure.getMessage().contains("success"), failure.getMessage());
    }

    @Test
    void rejectsAResponseConditionReadingOutsideTheResponse() {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG,
                        requestWith(Map.of(), Map.of("success", Map.of("task.serviceCode", "X"))), ACTOR));

        assertTrue(failure.getMessage().contains("task.serviceCode"), failure.getMessage());
    }

    @Test
    void rejectsAnUnknownResponseConditionKind() {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class,
                () -> service().upsert(TENANT, CHILD_ORG, requestWith(Map.of(), Map.of(
                        "success", Map.of("response.code", "OK"),
                        "maybe", Map.of("response.code", "HMM"))), ACTOR));

        assertTrue(failure.getMessage().contains("maybe"), failure.getMessage());
    }

    /* ---- reads and ownership ---- */

    @Test
    void marksAParentsBindingAsInheritedForTheChild() {
        bindings.visible = List.of(binding(PARENT_ORG), binding(CHILD_ORG));

        List<IntegrationEventBindingResponse> listed = service().list(TENANT, CHILD_ORG);

        assertTrue(listed.get(0).inherited(), "the parent's binding is inherited");
        assertFalse(listed.get(1).inherited(), "the child's own binding is not");
    }

    @Test
    void aChildCannotDeleteABindingItMerelyInherits() {
        bindings.byId = binding(PARENT_ORG);

        assertFalse(service().delete(TENANT, CHILD_ORG, "any-id", ACTOR));
        assertFalse(bindings.deleted, "an inherited binding must not be removable");
    }

    @Test
    void anOrgCanDeleteItsOwnBinding() {
        bindings.byId = binding(CHILD_ORG);

        assertTrue(service().delete(TENANT, CHILD_ORG, "any-id", ACTOR));
        assertTrue(bindings.deleted);
    }

    /* ---- picker feed and preview ---- */

    @Test
    void dispatchTargetsExposeTheOperationsFieldContract() {
        List<DispatchTargetResponse> targets = service().dispatchTargets(TENANT);

        assertEquals(1, targets.size());
        DispatchTargetResponse target = targets.get(0);
        assertEquals("PARTNER_API", target.connectionName());
        assertEquals(List.of("guidMultimedia", "aprobado"),
                target.fields().stream().map(DispatchTargetResponse.Field::id).toList());
        assertTrue(target.fields().get(0).required());
        assertEquals("boolean", target.fields().get(1).type());
    }

    @Test
    void dispatchTargetsSkipConnectionsThatAreNotActive() {
        connections.status = ConnectionStatus.TEST_FAILED;

        assertTrue(service().dispatchTargets(TENANT).isEmpty());
    }

    @Test
    void previewRendersTheBodyTheChannelWouldReceive() {
        BindingPreviewResponse preview = service().preview(TENANT, request(validTemplates()),
                Map.of("content", Map.of("mediaId", "19f8-a8ad"),
                        "review", Map.of("verdict", false)));

        assertTrue(preview.valid(), preview.problems().toString());
        Map<?, ?> payload = (Map<?, ?>) preview.payload();
        assertEquals("19f8-a8ad", payload.get("guidMultimedia"));
        assertEquals(Boolean.FALSE, payload.get("aprobado"));
    }

    @Test
    void previewReportsProblemsInsteadOfThrowing() {
        BindingPreviewResponse preview = service().preview(TENANT,
                request(Map.of("aprobado", "{{review.verdict}}")), Map.of());

        assertFalse(preview.valid());
        assertTrue(preview.problems().toString().contains("guidMultimedia"),
                preview.problems().toString());
    }

    /* ---------------------------------------------------------------- fakes */

    private static IntegrationEventBinding binding(String owner) {
        return new IntegrationEventBinding(
                "b-" + owner, TENANT, owner, "review.verdict", "kanban_lane", "k",
                CONNECTION_ID, OPERATION_ID, Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), true,
                OffsetDateTime.now(), OffsetDateTime.now(), ACTOR, ACTOR);
    }

    private static final class FakeBindings extends IntegrationEventBindingRepository {
        private final List<IntegrationEventBinding> saved = new ArrayList<>();
        private List<IntegrationEventBinding> visible = List.of();
        private IntegrationEventBinding byId;
        private boolean deleted;

        private FakeBindings() {
            super(null);
        }

        @Override
        public List<IntegrationEventBinding> listVisible(String tenantClientId, String orgSlug) {
            return visible;
        }

        @Override
        public IntegrationEventBinding findVisibleById(String tenant, String orgSlug, String id) {
            return byId;
        }

        @Override
        public IntegrationEventBinding upsert(IntegrationEventBinding binding, String actor) {
            saved.add(binding);
            return new IntegrationEventBinding(
                    "generated-id", binding.tenantClientId(), binding.ownerOrgSlug(),
                    binding.eventType(), binding.scopeKind(), binding.scopeKey(),
                    binding.connectionId(), binding.operationId(), binding.matchCondition(),
                    binding.fieldTemplates(), binding.responseTemplates(),
                    binding.fieldDefaults(), binding.responseConditions(), binding.enabled(),
                    OffsetDateTime.now(), OffsetDateTime.now(), actor, actor);
        }

        @Override
        public boolean softDelete(String tenant, String orgSlug, String id, String actor) {
            deleted = true;
            return true;
        }
    }

    private static final class FakeConnections extends IntegrationConnectionRepository {
        private ConnectionStatus status = ConnectionStatus.ACTIVE;
        private ProviderType providerType = ProviderType.CUSTOM_HTTP;

        private FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return connection();
        }

        @Override
        public List<IntegrationConnection> listByTenant(String tenantCode) {
            return List.of(connection());
        }

        private IntegrationConnection connection() {
            return new IntegrationConnection(
                    CONNECTION_ID, TENANT, "PARTNER_API", providerType,
                    URI.create("https://api.example.com"), "cred-1", status, null, null, Map.of());
        }
    }

    private static final class FakeOperations extends IntegrationOperationRepository {
        private IntegrationOperation operation = operation();

        private FakeOperations() {
            super(null);
        }

        @Override
        public IntegrationOperation findByConnectionAndId(String connectionId, String operationId) {
            return operation;
        }

        @Override
        public List<IntegrationOperation> listByConnection(String connectionId) {
            return operation == null ? List.of() : List.of(operation);
        }

        private static IntegrationOperation operation() {
            Map<String, Object> properties = new LinkedHashMap<>();
            properties.put("guidMultimedia", Map.of("type", "string"));
            properties.put("aprobado", Map.of("type", "boolean"));
            return new IntegrationOperation(
                    OPERATION_ID, CONNECTION_ID, "ActualizarEstado", "POST", "/v1/estado",
                    Map.of("type", "object", "properties", properties,
                            "required", List.of("guidMultimedia", "aprobado")),
                    Map.of(), false);
        }
    }
}
