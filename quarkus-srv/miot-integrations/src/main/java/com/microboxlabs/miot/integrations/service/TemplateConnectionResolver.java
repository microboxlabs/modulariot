package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Optional;
import org.jboss.logging.Logger;

/**
 * Which connection serves a named integration template for a tenant.
 *
 * <p>Callers name a template — the contract — rather than a connection, so one caller can serve N
 * tenants each with their own base URL and credential.
 *
 * <p>Empty is the normal rollout state, not an error: an unmigrated tenant keeps the credential it
 * used before. The two log lines are P3's gate — the shared credential comes out when "falls back"
 * stops appearing, since both paths otherwise succeed equally quietly. Both at INFO because at
 * WARN the expected fallback would get filtered.
 */
@ApplicationScoped
public class TemplateConnectionResolver {

    private static final Logger LOG = Logger.getLogger(TemplateConnectionResolver.class);

    private final IntegrationConnectionRepository connections;

    @Inject
    public TemplateConnectionResolver(IntegrationConnectionRepository connections) {
        this.connections = connections;
    }

    /**
     * The tenant's connection for {@code templateName}, or empty when it has none and the caller
     * should use its fallback credential.
     */
    public Optional<IntegrationConnection> resolve(String tenantCode, String templateName) {
        IntegrationConnection connection =
                connections.findActiveByTemplateName(tenantCode, templateName);

        if (connection == null) {
            LOG.infof("Integration template '%s' has no active connection for tenant %s; the "
                            + "caller falls back to its environment-configured credential. "
                            + "Retiring that variable stays blocked while this line appears.",
                    templateName, tenantCode);
            return Optional.empty();
        }

        // Credential profile id is the attribution that separates one tenant's grant from
        // another's, and is not itself a secret.
        LOG.infof("Integration template '%s' for tenant %s resolved to connection %s "
                        + "(credential profile %s).",
                templateName, tenantCode, connection.id(), connection.credentialProfileId());
        return Optional.of(connection);
    }
}
