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
 * <p>Callers name a template rather than a connection because a template is the contract they
 * depend on, while the connection is whichever instance a given tenant configured to satisfy it —
 * its own base URL and its own credential. That indirection is the point of the template model:
 * one caller, N tenant-specific credentials, no per-tenant branching in the caller.
 *
 * <p><b>An unresolved template is not an error.</b> Until every tenant has an instance, most
 * lookups return empty and the caller falls back to whatever credential it used before. Failing
 * closed here would break every tenant that has not been migrated yet, which is the opposite of
 * what a rollout needs.
 *
 * <p><b>The logging is a deliverable, not decoration.</b> Retiring a shared environment-configured
 * credential is only safe once no tenant still depends on it, and because the fallback path
 * succeeds just as quietly as the connection path, an absence of errors proves nothing. These two
 * lines are the positive signal: the variable comes out when the "falls back" line has stopped
 * appearing, not when nothing has broken.
 *
 * <p>Both are logged at INFO deliberately. The fallback is an expected transitional state, and at
 * WARN it would be alarming enough to get filtered — which would destroy exactly the signal it
 * exists to provide.
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
     * The tenant's connection for {@code templateName}, or empty when it has no instance and the
     * caller should use its fallback credential.
     *
     * @param tenantCode   the tenant whose instance is wanted; its own templates only
     * @param templateName the contract being asked for, matched case-insensitively
     */
    public Optional<IntegrationConnection> resolve(String tenantCode, String templateName) {
        IntegrationConnection connection =
                connections.findActiveByTemplateName(tenantCode, templateName);

        if (connection == null) {
            // Named rather than counted so the retirement check is a log query, and worded so
            // whoever finds it knows what it blocks.
            LOG.infof("Integration template '%s' has no active connection for tenant %s; the "
                            + "caller falls back to its environment-configured credential. "
                            + "Retiring that variable stays blocked while this line appears.",
                    templateName, tenantCode);
            return Optional.empty();
        }

        // The credential profile id is the attribution that matters: it is what distinguishes
        // one tenant's grant from another's, and it is not itself a secret.
        LOG.infof("Integration template '%s' for tenant %s resolved to connection %s "
                        + "(credential profile %s).",
                templateName, tenantCode, connection.id(), connection.credentialProfileId());
        return Optional.of(connection);
    }
}
