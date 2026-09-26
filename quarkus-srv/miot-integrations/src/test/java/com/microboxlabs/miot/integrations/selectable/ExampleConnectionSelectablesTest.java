package com.microboxlabs.miot.integrations.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableSource;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ExampleConnectionSelectablesTest {

    private static final String TENANT = "tenant-a";

    static final class FakeTemplates extends IntegrationTemplateService {
        final List<IntegrationTemplate> templates = new ArrayList<>();

        FakeTemplates() {
            super(null, null);
        }

        @Override
        public List<IntegrationTemplate> listTemplates(String tenantCode) {
            return templates.stream().filter(t -> t.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationTemplate createTemplate(String tenantCode, CreateIntegrationTemplateRequest req) {
            IntegrationTemplate t = new IntegrationTemplate("tpl-" + (templates.size() + 1), tenantCode, req.name(),
                    req.providerType(), req.operationName(), req.method(), req.path(), req.requestSchema(),
                    req.responseSchema());
            templates.add(t);
            return t;
        }
    }

    /**
     * Connections and operations kept in lists. Creating from a template copies its operation,
     * and a test marks the connection ACTIVE, as the real service and generic tester do.
     */
    static final class FakeConnections extends IntegrationConnectionService {
        final FakeTemplates templates;
        final List<IntegrationConnection> connections = new ArrayList<>();
        final List<IntegrationOperation> operations = new ArrayList<>();
        int tests;
        boolean broken;

        FakeConnections(FakeTemplates templates) {
            super(null, null, null, null, null, null, null);
            this.templates = templates;
        }

        @Override
        public List<IntegrationConnection> listConnections(String tenantCode) {
            if (broken) {
                throw new IllegalStateException("database down");
            }
            return connections.stream().filter(c -> c.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationConnection createConnection(String tenantCode, CreateIntegrationConnectionRequest req) {
            IntegrationTemplate t = templates.templates.stream().filter(x -> x.id().equals(req.templateId()))
                    .findFirst().orElseThrow();
            IntegrationConnection c = new IntegrationConnection("conn-" + (connections.size() + 1), tenantCode,
                    req.name(), t.providerType(), req.baseUrl(), null, ConnectionStatus.DRAFT, null, null,
                    Map.of(), t.id());
            connections.add(c);
            operations.add(new IntegrationOperation("op-" + (operations.size() + 1), c.id(), t.operationName(),
                    t.method(), t.path(), t.requestSchema(), t.responseSchema(), false));
            return c;
        }

        @Override
        public List<IntegrationOperation> listOperations(String tenantCode, String connectionId) {
            return operations.stream().filter(o -> o.connectionId().equals(connectionId)).toList();
        }

        @Override
        public ConnectionTestResponse testConnection(String tenantCode, String connectionId,
                ConnectionTestRequest req) {
            tests++;
            connections.replaceAll(c -> c.id().equals(connectionId)
                    ? new IntegrationConnection(c.id(), c.tenantCode(), c.name(), c.providerType(), c.baseUrl(),
                            null, ConnectionStatus.ACTIVE, null, true, c.metadata(), c.templateId())
                    : c);
            return new ConnectionTestResponse(true, OffsetDateTime.now(), "ok");
        }
    }

    private final FakeTemplates templates = new FakeTemplates();
    private final FakeConnections connections = new FakeConnections(templates);

    private ExampleConnectionSelectables example(boolean enabled) {
        return new ExampleConnectionSelectables(templates, connections, enabled);
    }

    @Test
    void offersNothingUnlessEnabled() {
        assertEquals(List.of(), example(false).forTenant(TENANT));
        assertTrue(templates.templates.isEmpty(), "no template is created");
        assertTrue(connections.connections.isEmpty(), "no connection is created");
    }

    @Test
    void createsATemplateAConnectionFromItAndAListThatUsesIt() {
        List<Selectable> lists = example(true).forTenant(TENANT);

        IntegrationTemplate template = templates.templates.get(0);
        assertEquals(ExampleConnectionSelectables.TEMPLATE_NAME, template.name());
        assertEquals("GET", template.method());
        assertEquals(ExampleConnectionSelectables.RESPONSE_SCHEMA, template.responseSchema(),
                "the editor suggests fields from it");
        IntegrationConnection connection = connections.connections.get(0);
        assertEquals(template.id(), connection.templateId());
        assertEquals(ExampleConnectionSelectables.BASE_URL, connection.baseUrl());
        assertEquals(ConnectionStatus.ACTIVE, connection.status(), "only active connections are offered");

        Selectable country = lists.get(0);
        assertEquals("country", country.key());
        assertEquals(SelectableSource.Kind.CONNECTION, country.source().kind());
        assertEquals(connection.id() + ":" + connections.operations.get(0).id(), country.source().ref());
    }

    @Test
    void reusesTheTemplateAndConnectionOnReset() {
        ExampleConnectionSelectables example = example(true);
        String first = example.forTenant(TENANT).get(0).source().ref();
        String again = example.forTenant(TENANT).get(0).source().ref();

        assertEquals(first, again);
        assertEquals(1, templates.templates.size());
        assertEquals(1, connections.connections.size());
        assertEquals(1, connections.tests, "an active connection is not tested again");
    }

    @Test
    void aFailureLeavesTheOtherDefaultsAlone() {
        connections.broken = true;

        assertEquals(List.of(), example(true).forTenant(TENANT));
    }

    @Test
    void theListsMappingPassesTheChecksAndReadsTheApisAnswer() {
        String answer = """
                {"error": false, "msg": "countries and ISO codes retrieved",
                 "data": [{"name": "Chile", "Iso2": "CL", "Iso3": "CHL"}]}""";
        SelectableSource source = ExampleConnectionSelectables.list("c:o").source();
        ConnectionOptionSource connectionSource = new ConnectionOptionSource(null, null, null);

        connectionSource.check(source);
        var options = connectionSource.toOptions(answer, new ConnectionOptionSource.Mapping(source.config()));

        assertEquals("CL", options.get(0).value());
        assertEquals("Chile", options.get(0).label().get("es"));
    }
}
