package com.microboxlabs.miot.core.alfresco;

import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

/**
 * Stub implementation of {@link IAlfrescoGroupAdminClient}. Logs the
 * mutation and returns success without touching Alfresco. Active by
 * default so dev / CI flows can exercise the write endpoints without
 * a live Alfresco instance.
 */
@ApplicationScoped
@DefaultBean
public class StubAlfrescoGroupAdminClient implements IAlfrescoGroupAdminClient {

    private static final Logger LOG = Logger.getLogger(StubAlfrescoGroupAdminClient.class);

    @Override
    public Uni<String> createGroup(String groupId, String displayName) {
        LOG.warnf("STUB: createGroup(%s, displayName=%s) — no-op", groupId, displayName);
        return Uni.createFrom().item(groupId);
    }

    @Override
    public Uni<Void> addGroupMember(String groupId, String personId) {
        LOG.warnf("STUB: addGroupMember(%s, %s) — no-op", groupId, personId);
        return Uni.createFrom().voidItem();
    }

    @Override
    public Uni<Void> removeGroupMember(String groupId, String personId) {
        LOG.warnf("STUB: removeGroupMember(%s, %s) — no-op", groupId, personId);
        return Uni.createFrom().voidItem();
    }
}
