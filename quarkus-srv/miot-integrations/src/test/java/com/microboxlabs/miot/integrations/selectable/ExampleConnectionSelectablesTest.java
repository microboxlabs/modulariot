package com.microboxlabs.miot.integrations.selectable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableSource;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ExampleConnectionSelectablesTest {

    private static final String TENANT = "tenant-a";

    /** Connections and operations kept in lists; a test marks the connection ACTIVE, as the generic tester does. */
    static final class FakeConnections extends IntegrationConnectionService {
        final List<IntegrationConnection> connections = new ArrayList<>();
        final List<IntegrationOperation> operations = new ArrayList<>();
        int tests;
        boolean broken;

        FakeConnections() {
            super(null, null, null, null, null, null, null);
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
            IntegrationConnection c = new IntegrationConnection("conn-" + (connections.size() + 1), tenantCode,
                    req.name(), req.providerType(), req.baseUrl(), null, ConnectionStatus.DRAFT, null, null,
                    Map.of());
            connections.add(c);
            return c;
        }

        @Override
        public List<IntegrationOperation> listOperations(String tenantCode, String connectionId) {
            return operations.stream().filter(o -> o.connectionId().equals(connectionId)).toList();
        }

        @Override
        public IntegrationOperation addOperation(String tenantCode, String connectionId,
                CreateIntegrationOperationRequest req) {
            IntegrationOperation o = new IntegrationOperation("op-" + (operations.size() + 1), connectionId,
                    req.name(), req.method(), req.path(), Map.of(), Map.of(), req.testOperation());
            operations.add(o);
            return o;
        }

        @Override
        public ConnectionTestResponse testConnection(String tenantCode, String connectionId,
                ConnectionTestRequest req) {
            tests++;
            connections.replaceAll(c -> c.id().equals(connectionId)
                    ? new IntegrationConnection(c.id(), c.tenantCode(), c.name(), c.providerType(), c.baseUrl(),
                            null, ConnectionStatus.ACTIVE, null, true, c.metadata())
                    : c);
            return new ConnectionTestResponse(true, OffsetDateTime.now(), "ok");
        }
    }

    private final FakeConnections connections = new FakeConnections();

    @Test
    void offersNothingUnlessEnabled() {
        assertEquals(List.of(), new ExampleConnectionSelectables(connections, false).forTenant(TENANT));
        assertTrue(connections.connections.isEmpty(), "no connection is created");
    }

    @Test
    void createsTheExampleConnectionAndAListThatUsesIt() {
        List<Selectable> lists = new ExampleConnectionSelectables(connections, true).forTenant(TENANT);

        IntegrationConnection connection = connections.connections.get(0);
        assertEquals(ExampleConnectionSelectables.CONNECTION_NAME, connection.name());
        assertEquals(ExampleConnectionSelectables.BASE_URL, connection.baseUrl());
        assertEquals(ConnectionStatus.ACTIVE, connection.status(), "only active connections are offered");
        IntegrationOperation operation = connections.operations.get(0);
        assertEquals("GET", operation.method());

        Selectable country = lists.get(0);
        assertEquals("country", country.key());
        assertEquals(new SelectableSource(SelectableSource.Kind.CONNECTION,
                connection.id() + ":" + operation.id(), Map.of("value", "Iso2")), country.source());
    }

    @Test
    void reusesTheConnectionOnReset() {
        ExampleConnectionSelectables example = new ExampleConnectionSelectables(connections, true);
        String first = example.forTenant(TENANT).get(0).source().ref();
        String again = example.forTenant(TENANT).get(0).source().ref();

        assertEquals(first, again);
        assertEquals(1, connections.connections.size());
        assertEquals(1, connections.operations.size());
        assertEquals(1, connections.tests, "an active connection is not tested again");
    }

    @Test
    void aFailureLeavesTheOtherDefaultsAlone() {
        connections.broken = true;

        assertEquals(List.of(), new ExampleConnectionSelectables(connections, true).forTenant(TENANT));
    }

    @Test
    void theListReadsTheApisAnswer() {
        String answer = """
                {"error": false, "msg": "countries and ISO codes retrieved",
                 "data": [{"name": "Chile", "Iso2": "CL", "Iso3": "CHL"}]}""";
        ConnectionOptionSource.Mapping mapping = new ConnectionOptionSource.Mapping(
                ExampleConnectionSelectables.list("c:o").source().config());

        var options = new ConnectionOptionSource(null, null, null).toOptions(answer, mapping);

        assertEquals("CL", options.get(0).value());
        assertEquals("Chile", options.get(0).label().get("es"));
    }
}
