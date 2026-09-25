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
        int calls;

        FakeInvoker() {
            super(null, null, null, 20);
        }

        @Override
        public OperationInvocationResult invoke(String tenantCode, String connectionId, String operationId,
                Object body) {
            calls++;
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
    void followsTheConfiguredPathsAndFiltersBySearchAndParent() {
        Map<String, Object> config = Map.of("items", "data", "value", "name", "label", "name", "parent", "zone.code");

        assertEquals(List.of("Bodega Sur"), options(config, "bodega", List.of()).stream()
                .map(SelectableOption::value).toList());
        assertEquals(List.of("Planta Norte"), options(config, null, List.of("N")).stream()
                .map(SelectableOption::value).toList());
    }

    @Test
    void callsTheProviderOnceAMinuteWhileTheUserTypes() {
        options(Map.of(), "p", List.of());
        options(Map.of(), "pl", List.of());
        options(Map.of(), "pla", List.of());

        assertEquals(1, invoker.calls);
    }

    @Test
    void refusesWhatAFieldMustNotCall() {
        assertThrows(IllegalArgumentException.class, () -> source.options(TENANT,
                new SelectableSource(SelectableSource.Kind.CONNECTION, "c1:post", Map.of()),
                new SelectableOptionSource.Query(null, List.of(), 10)));
        assertThrows(IllegalArgumentException.class, () -> source.options(TENANT,
                new SelectableSource(SelectableSource.Kind.CONNECTION, "c2:get", Map.of()),
                new SelectableOptionSource.Query(null, List.of(), 10)));
        assertThrows(IllegalArgumentException.class, () -> source.options(TENANT,
                new SelectableSource(SelectableSource.Kind.CONNECTION, "c1", Map.of()),
                new SelectableOptionSource.Query(null, List.of(), 10)));
    }

    @Test
    void aFailedOrUnreadableAnswerIsReported() {
        invoker.answer = new OperationInvocationResult(503, "down");
        assertThrows(SourceUnavailableException.class, () -> options(Map.of(), null, List.of()));

        invoker.answer = new OperationInvocationResult(200, "{\"total\": 3}");
        assertThrows(SourceUnavailableException.class, () -> options(Map.of("items", "rows"), null, List.of()));
    }
}
