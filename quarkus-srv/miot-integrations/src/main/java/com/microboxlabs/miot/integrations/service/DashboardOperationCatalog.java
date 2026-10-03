package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

/** Names and ids of a tenant's dashboard-eligible operations, for saved-query authoring. No schemas, paths or credentials. */
@ApplicationScoped
public class DashboardOperationCatalog {
    static final int MAX_CONNECTIONS = 100;
    static final int MAX_OPERATIONS = 100;
    private static final int MAX_LABEL = 256;
    private final IntegrationConnectionRepository connections;
    private final IntegrationOperationRepository operations;

    public record Operation(String id, String label) {
    }

    public record Connection(String id, String label, List<Operation> operations) {
    }

    @Inject
    public DashboardOperationCatalog(IntegrationConnectionRepository connections, IntegrationOperationRepository operations) {
        this.connections = connections;
        this.operations = operations;
    }

    public List<Connection> list(String tenantCode) {
        return connections.listByTenant(tenantCode).stream()
                .filter(connection -> connection.status() == ConnectionStatus.ACTIVE)
                .map(connection -> new Connection(connection.id(), label(connection.name(), connection.id()),
                        operations.listByConnection(connection.id()).stream()
                                .filter(DashboardOperationPolicy::eligible)
                                .limit(MAX_OPERATIONS)
                                .map(operation -> new Operation(operation.id(), label(operation.name(), operation.id())))
                                .toList()))
                .filter(connection -> !connection.operations().isEmpty())
                .limit(MAX_CONNECTIONS)
                .toList();
    }

    private static String label(String name, String fallback) {
        String value = name == null || name.isBlank() ? fallback : name.strip();
        return value.length() > MAX_LABEL ? value.substring(0, MAX_LABEL) : value;
    }
}
