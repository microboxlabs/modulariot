package com.microboxlabs.miot.integrations.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectableOptionSource;
import com.microboxlabs.miot.core.selectable.SelectableSource;
import com.microboxlabs.miot.core.selectable.SourceUnavailableException;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ConnectionOptionSourceTest {

    private static final String TENANT = "tenant-a";
    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");
    private static final String SITES = """
            {"data": [
              {"id": "S1", "name": "Planta Norte", "zone": {"code": "N"}},
              {"id": "S2", "name": "Bodega Sur", "zone": {"code": "S"}},
              {"name": "sin id"}
            ]}""";

    private static IntegrationConnection connection(String id, String name, ConnectionStatus status) {
        return new IntegrationConnection(id, TENANT, name, ProviderType.values()[0], URI.create("https://api.example.com"),
                null, status, null, null, Map.of());
    }

    private static IntegrationOperation operation(String id, String connectionId, String method) {
        return new IntegrationOperation(id, connectionId, "Sites " + method, method, "/sites", Map.of(), Map.of(),
                false);
    }

    private final IntegrationConnectionRepository connections = new IntegrationConnectionRepository(null) {
        @Override
        public List<IntegrationConnection> listByTenant(String tenantCode) {
            return List.of(connection("c1", "ERP", ConnectionStatus.ACTIVE),
                    connection("c2", "Draft", ConnectionStatus.DRAFT));
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return listByTenant(tenantCode).stream().filter(c -> c.id().equals(connectionId)).findFirst()
                    .orElse(null);
        }
    };

    private final IntegrationOperationRepository operations = new IntegrationOperationRepository(null) {
        @Override
        public List<IntegrationOperation> listByConnection(String connectionId) {
            return List.of(operation("get", connectionId, "GET"), operation("post", connectionId, "POST"));
        }

        @Override
        public IntegrationOperation findByConnectionAndId(String connectionId, String operationId) {
            return listByConnection(connectionId).stream().filter(o -> o.id().equals(operationId)).findFirst()
                    .orElse(null);
        }
    };

    /** Answers every call with {@link #answer} and counts the calls. */
    private final class FakeInvoker extends IntegrationOperationInvoker {
        OperationInvocationResult answer = new OperationInvocationResult(200, SITES);
        RuntimeException failure;
        int calls;

        FakeInvoker() {
            super(null, null, null, 20);
        }

        @Override
        public OperationInvocationResult invoke(String tenantCode, String connectionId, String operationId,
                Object body) {
            calls++;
            if (failure != null) {
                throw failure;
            }
            return answer;
        }
    }

    private final FakeInvoker invoker = new FakeInvoker();
    private final ConnectionOptionSource source =
            new ConnectionOptionSource(connections, operations, invoker, Clock.fixed(NOW, ZoneOffset.UTC));

    private List<SelectableOption> options(Map<String, Object> config, String search, List<String> parents) {
        return source.options(TENANT, new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:get", config),
                new SelectableOptionSource.Query(search, parents, 50));
    }

    @Test
    void offersOnlyTheGetOperationsOfActiveConnections() {
        List<SelectableOptionSource.Descriptor> offered = source.describe(TENANT);

        assertEquals(List.of("c1:get"), offered.stream().map(SelectableOptionSource.Descriptor::ref).toList());
        assertEquals("ERP › Sites GET", offered.get(0).label().get("es"));
        assertEquals("GET /sites", offered.get(0).description().get("en"));
    }

    @Test
    void findsTheItemsAndMapsIdAndNameByDefault() {
        List<SelectableOption> sites = options(Map.of(), null, List.of());

        assertEquals(List.of("S1", "S2"), sites.stream().map(SelectableOption::value).toList());
        assertEquals("Planta Norte", sites.get(0).label().get("en"));
    }

    @Test
    void followsTheConfiguredTemplatesAndFiltersBySearchAndParent() {
        Map<String, Object> config = Map.of("items", "{{response.data}}", "value", "{{item.name}}",
                "label", "{{item.name}}", "parent", "{{item.zone.code}}");

        assertEquals(List.of("Bodega Sur"), options(config, "bodega", List.of()).stream()
                .map(SelectableOption::value).toList());
        assertEquals(List.of("Planta Norte"), options(config, null, List.of("N")).stream()
                .map(SelectableOption::value).toList());
    }

    @Test
    void aLabelOrDescriptionMayCombineFields() {
        Map<String, Object> config = Map.of("label", "{{item.name}} ({{item.id}})",
                "description", "Zona {{item.zone.code}}");

        SelectableOption north = options(config, null, List.of()).get(0);

        assertEquals("Planta Norte (S1)", north.label().get("es"));
        assertEquals("Zona N", north.description().get("es"));
    }

    @Test
    void refusesAMappingTheTemplateEngineWouldNotRender() {
        for (Map<String, Object> config : List.of(
                Map.<String, Object>of("label", "{{#if item.name}}x{{/if}}"),
                Map.<String, Object>of("label", "{{upper item.name}}"),
                Map.<String, Object>of("value", "{{task.id}}"),
                Map.<String, Object>of("value", "{{item}}"),
                Map.<String, Object>of("items", "{{item.data}}"),
                Map.<String, Object>of("items", "list: {{response.data}}"))) {
            SelectableSource bad = new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:get", config);
            assertThrows(IllegalArgumentException.class, () -> source.check(bad), config.toString());
        }
        source.check(new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:get",
                Map.of("items", "{{ response.data }}", "label", "{{item.name}} · {{item.zone.code}}")));
        SelectableSource noOperation = new SelectableSource(SelectableSource.Kind.CONNECTION, "c1", Map.of());
        assertThrows(IllegalArgumentException.class, () -> source.check(noOperation));
    }

    @Test
    void callsTheProviderOnceAMinuteWhileTheUserTypes() {
        options(Map.of(), "p", List.of());
        options(Map.of(), "pl", List.of());
        options(Map.of(), "pla", List.of());

        assertEquals(1, invoker.calls);
    }

    @Test
    void dropsAnswersNobodyAsksForAgain() {
        MutableClock clock = new MutableClock();
        ConnectionOptionSource ticking = new ConnectionOptionSource(connections, operations, invoker, clock);
        SelectableOptionSource.Query all = new SelectableOptionSource.Query(null, List.of(), 10);

        ticking.options(TENANT, new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:get",
                Map.of("label", "{{item.id}}")), all);
        clock.now = NOW.plus(ConnectionOptionSource.KEEP).plusSeconds(1);
        ticking.options(TENANT, new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:get", Map.of()), all);

        assertEquals(1, ticking.keptAnswers(), "the first mapping's answer expired and is gone");
    }

    @Test
    void aConnectionThatCannotBeCalledIsUnavailableNotABadRequest() {
        SelectableSource sites = new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:get", Map.of());
        SelectableOptionSource.Query all = new SelectableOptionSource.Query(null, List.of(), 10);

        invoker.failure = new IllegalArgumentException("connection base URL must not point to an internal address");
        assertThrows(SourceUnavailableException.class, () -> source.options(TENANT, sites, all));

        invoker.failure = new ConnectionResolutionException("credential profile not found");
        assertThrows(SourceUnavailableException.class, () -> source.options(TENANT, sites, all));
    }

    @Test
    void refusesWhatAFieldMustNotCall() {
        SelectableOptionSource.Query all = new SelectableOptionSource.Query(null, List.of(), 10);
        for (String ref : List.of("c1:post", "c2:get", "c1")) {
            SelectableSource refused = new SelectableSource(SelectableSource.Kind.CONNECTION, ref, Map.of());
            assertThrows(IllegalArgumentException.class, () -> source.options(TENANT, refused, all), ref);
        }
    }

    static final class MutableClock extends Clock {
        Instant now = NOW;

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void aFailedOrUnreadableAnswerIsReported() {
        invoker.answer = new OperationInvocationResult(503, "down");
        assertThrows(SourceUnavailableException.class, () -> options(Map.of(), null, List.of()));

        invoker.answer = new OperationInvocationResult(200, "{\"total\": 3}");
        assertThrows(SourceUnavailableException.class, () -> options(Map.of("items", "{{response.rows}}"), null, List.of()));
    }
}
