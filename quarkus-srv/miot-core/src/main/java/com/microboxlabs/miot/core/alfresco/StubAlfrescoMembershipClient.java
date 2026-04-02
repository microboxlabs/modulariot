package com.microboxlabs.miot.core.alfresco;

import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

/**
 * Stub implementation — always approves membership.
 * Active by default until a real Alfresco REST client is registered.
 */
@ApplicationScoped
@DefaultBean
public class StubAlfrescoMembershipClient implements IAlfrescoMembershipClient {

    private static final Logger LOG = Logger.getLogger(StubAlfrescoMembershipClient.class);

    @Override
    public Uni<Boolean> isMember(String personId, String groupId) {
        LOG.warnf("STUB: membership check for '%s' in '%s' — always returning true", personId, groupId);
        return Uni.createFrom().item(true);
    }

    @Override
    public Uni<String> getRole(String personId, String groupId) {
        LOG.warnf("STUB: role lookup for '%s' in '%s' — returning SITE_MANAGER", personId, groupId);
        return Uni.createFrom().item("SITE_MANAGER");
    }
}
