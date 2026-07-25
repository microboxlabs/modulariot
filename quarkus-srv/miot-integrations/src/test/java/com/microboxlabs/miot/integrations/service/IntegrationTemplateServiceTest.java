package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationTemplateRepository;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationTemplateServiceTest {

    private static final String TENANT = "tenant-1";

    private final FakeTemplates templates = new FakeTemplates();
    private final FakeConnections connections = new FakeConnections();

    private IntegrationTemplateService service() {
        return new IntegrationTemplateService(templates, connections);
    }

    private static CreateIntegrationTemplateRequest createRequest(String name, String method) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", Map.of("guidMultimedia", Map.of("type", "string")));
        return new CreateIntegrationTemplateRequest(
                name, ProviderType.CUSTOM_HTTP, "", method, "/v1/estado", schema, Map.of());
    }

    @Test
    void createDefaultsOperationNameToTemplateNameAndUppercasesMethod() {
        IntegrationTemplate created = service().createTemplate(TENANT, createRequest("Dev Mentor", "post"));

        assertEquals("Dev Mentor", created.name());
        // Blank operationName falls back to the template name.
        assertEquals("Dev Mentor", created.operationName());
        // Method is normalised to the case the CHECK constraint accepts.
        assertEquals("POST", created.method());
        assertEquals(ProviderType.CUSTOM_HTTP, created.providerType());
        assertEquals(created, templates.store.get(created.id()));
    }

    @Test
    void updateLeavesNullFieldsUnchanged() {
        IntegrationTemplate created = service().createTemplate(TENANT, createRequest("Dev Mentor", "POST"));

        IntegrationTemplate updated = service().updateTemplate(
                TENANT, created.id(),
                new UpdateIntegrationTemplateRequest(null, null, null, "/v2/estado", null, null));

        assertEquals("Dev Mentor", updated.name());
        assertEquals("/v2/estado", updated.path());
        assertEquals("POST", updated.method());
    }

    @Test
    void updateMissingTemplateReturnsNull() {
        assertNull(service().updateTemplate(
                TENANT, "no-such-id",
                new UpdateIntegrationTemplateRequest("x", null, null, null, null, null)));
    }

    @Test
    void deleteSucceedsWhenNoInstances() {
        IntegrationTemplate created = service().createTemplate(TENANT, createRequest("Dev Mentor", "POST"));

        assertTrue(service().deleteTemplate(TENANT, created.id()));
        assertFalse(templates.store.containsKey(created.id()));
    }

    @Test
    void deleteRefusedWhileInstancesExist() {
        IntegrationTemplate created = service().createTemplate(TENANT, createRequest("Dev Mentor", "POST"));
        connections.instances = List.of(instanceOf(created.id()));

        IllegalStateException error = assertThrows(
                IllegalStateException.class, () -> service().deleteTemplate(TENANT, created.id()));
        assertTrue(error.getMessage().contains("1 connection"));
        // The template survives the refused delete.
        assertTrue(templates.store.containsKey(created.id()));
    }

    @Test
    void deleteMissingTemplateReturnsFalse() {
        assertFalse(service().deleteTemplate(TENANT, "no-such-id"));
    }

    /* ---- create-instance-from-template (IntegrationConnectionService) ---- */

    @Test
    void creatingAConnectionFromATemplateProvisionsItsOperation() {
        IntegrationTemplate template = service().createTemplate(TENANT, createRequest("Dev Mentor", "POST"));
        FakeOperations operations = new FakeOperations();
        IntegrationConnectionService connectionService = new IntegrationConnectionService(
                null, null, connections, operations, templates, null);

        IntegrationConnection created = connectionService.createConnection(
                TENANT,
                new CreateIntegrationConnectionRequest(
                        "Dev Mentor QA", null, URI.create("https://qa.example.com"),
                        "cred-qa", Map.of(), template.id()));

        // The instance records its template and inherits the template's provider type.
        assertEquals(template.id(), created.templateId());
        assertEquals(ProviderType.CUSTOM_HTTP, created.providerType());
        // Exactly one operation was provisioned, copying the template's contract.
        assertEquals(1, operations.created.size());
        IntegrationOperation op = operations.created.get(0);
        assertEquals(created.id(), op.connectionId());
        assertEquals("Dev Mentor", op.name());
        assertEquals("POST", op.method());
        assertEquals("/v1/estado", op.path());
        assertEquals(template.requestSchema(), op.requestSchema());
    }

    @Test
    void creatingAConnectionFromAnUnknownTemplateFails() {
        FakeOperations operations = new FakeOperations();
        IntegrationConnectionService connectionService = new IntegrationConnectionService(
                null, null, connections, operations, templates, null);

        assertThrows(IllegalArgumentException.class, () -> connectionService.createConnection(
                TENANT,
                new CreateIntegrationConnectionRequest(
                        "Ghost", null, URI.create("https://x"), null, Map.of(), "no-such-template")));
        assertTrue(operations.created.isEmpty());
    }

    @Test
    void creatingAnAdHocConnectionProvisionsNoOperation() {
        FakeOperations operations = new FakeOperations();
        IntegrationConnectionService connectionService = new IntegrationConnectionService(
                null, null, connections, operations, templates, null);

        IntegrationConnection created = connectionService.createConnection(
                TENANT,
                new CreateIntegrationConnectionRequest(
                        "Ad hoc", ProviderType.N8N, URI.create("https://x"), null, Map.of(), null));

        assertNull(created.templateId());
        assertEquals(ProviderType.N8N, created.providerType());
        assertTrue(operations.created.isEmpty());
    }

    private static IntegrationConnection instanceOf(String templateId) {
        return new IntegrationConnection(
                "conn-1", TENANT, "Dev Mentor QA", ProviderType.CUSTOM_HTTP,
                URI.create("https://qa.example.com"), "cred-qa",
                com.microboxlabs.miot.integrations.domain.ConnectionStatus.DRAFT,
                null, null, Map.of(), templateId);
    }

    /* ---- fakes ---- */

    private static final class FakeTemplates extends IntegrationTemplateRepository {
        private final Map<String, IntegrationTemplate> store = new LinkedHashMap<>();

        private FakeTemplates() {
            super(null);
        }

        @Override
        public List<IntegrationTemplate> listByTenant(String tenantCode) {
            return new ArrayList<>(store.values());
        }

        @Override
        public IntegrationTemplate findByTenantAndId(String tenantCode, String templateId) {
            return store.get(templateId);
        }

        @Override
        public IntegrationTemplate create(IntegrationTemplate template) {
            store.put(template.id(), template);
            return template;
        }

        @Override
        public IntegrationTemplate update(
                String tenantCode, String templateId, String name, String operationName,
                String method, String path, Map<String, Object> requestSchema,
                Map<String, Object> responseSchema) {
            IntegrationTemplate existing = store.get(templateId);
            if (existing == null) {
                return null;
            }
            IntegrationTemplate updated = new IntegrationTemplate(
                    existing.id(), existing.tenantCode(),
                    name != null ? name : existing.name(),
                    existing.providerType(),
                    operationName != null ? operationName : existing.operationName(),
                    method != null ? method : existing.method(),
                    path != null ? path : existing.path(),
                    requestSchema != null ? requestSchema : existing.requestSchema(),
                    responseSchema != null ? responseSchema : existing.responseSchema());
            store.put(templateId, updated);
            return updated;
        }

        @Override
        public boolean softDelete(String tenantCode, String templateId) {
            return store.remove(templateId) != null;
        }
    }

    private static final class FakeConnections extends IntegrationConnectionRepository {
        private List<IntegrationConnection> instances = List.of();

        private FakeConnections() {
            super(null);
        }

        @Override
        public List<IntegrationConnection> listByTemplate(String tenantCode, String templateId) {
            return instances;
        }

        @Override
        public IntegrationConnection create(IntegrationConnection connection) {
            return connection;
        }
    }

    private static final class FakeOperations extends IntegrationOperationRepository {
        private final List<IntegrationOperation> created = new ArrayList<>();

        private FakeOperations() {
            super(null);
        }

        @Override
        public IntegrationOperation create(IntegrationOperation operation) {
            created.add(operation);
            return operation;
        }
    }
}
