package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import com.microboxlabs.miot.integrations.service.OperationInvocationException;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Integration templates, connections and operation calls in memory, for {@link ConnectionChannels}. */
final class InMemoryIntegrations {

    record Call(String tenantCode, String connectionId, String operation, Map<String, Object> body) {
    }

    final List<IntegrationTemplate> templates = new ArrayList<>();
    final List<IntegrationConnection> connections = new ArrayList<>();
    final List<Call> calls = new ArrayList<>();
    /** What the next calls answer; null throws {@link #failure}. */
    OperationInvocationResult answer = new OperationInvocationResult(204, "");
    String failure = "connection refused";
    /** Thrown as is by the next calls when set, like the invoker's URL guard. */
    RuntimeException thrown;
    /** The status new connections get; tested connections are ACTIVE. */
    ConnectionStatus createdStatus = ConnectionStatus.ACTIVE;

    final IntegrationTemplateService templateService = new IntegrationTemplateService(null, null) {
        @Override
        public List<IntegrationTemplate> listTemplates(String tenantCode) {
            return templates.stream().filter(t -> t.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationTemplate createTemplate(String tenantCode, CreateIntegrationTemplateRequest req) {
            IntegrationTemplate t = new IntegrationTemplate(UUID.randomUUID().toString(), tenantCode, req.name(),
                    req.providerType(), req.operationName(), req.method(), req.path(), req.requestSchema(),
                    req.responseSchema());
            templates.add(t);
            return t;
        }
    };

    final IntegrationConnectionService connectionService = new IntegrationConnectionService(null, null, null, null,
            null, null, null) {
        @Override
        public List<IntegrationConnection> listConnections(String tenantCode) {
            return connections.stream().filter(c -> c.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationConnection getConnection(String tenantCode, String connectionId) {
            return connections.stream().filter(c -> c.tenantCode().equals(tenantCode) && c.id().equals(connectionId))
                    .findFirst().orElse(null);
        }

        @Override
        public IntegrationConnection createConnection(String tenantCode, CreateIntegrationConnectionRequest req) {
            IntegrationConnection c = new IntegrationConnection(UUID.randomUUID().toString(), tenantCode, req.name(),
                    req.providerType(), req.baseUrl(), req.credentialProfileId(), createdStatus, null, null,
                    req.metadata(), req.templateId());
            connections.add(c);
            return c;
        }
    };

    final IntegrationOperationInvoker invoker = new IntegrationOperationInvoker(null, null, null, 1) {
        @Override
        public OperationInvocationResult invokeByName(String tenantCode, String connectionId, String operationName,
                Map<String, Object> body) {
            calls.add(new Call(tenantCode, connectionId, operationName, body));
            if (thrown != null) {
                throw thrown;
            }
            if (answer == null) {
                throw new OperationInvocationException(failure);
            }
            return answer;
        }
    };

    final ConnectionChannels channels = new ConnectionChannels(templateService, connectionService, invoker);
}
