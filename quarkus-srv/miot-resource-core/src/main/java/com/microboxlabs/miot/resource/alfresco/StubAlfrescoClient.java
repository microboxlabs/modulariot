package com.microboxlabs.miot.resource.alfresco;

import com.microboxlabs.miot.resource.event.EntityType;
import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
@DefaultBean
public class StubAlfrescoClient implements IAlfrescoClient {

    private static final Logger LOG = Logger.getLogger(StubAlfrescoClient.class);

    @Override
    public Uni<String> createEntityFolder(String clientId, EntityType entityType, UUID entityId,
                                          Map<String, Object> properties) {
        LOG.infof("STUB: createEntityFolder for %s/%s/%s", clientId, entityType, entityId);
        return Uni.createFrom().item(UUID.randomUUID().toString());
    }

    @Override
    public Uni<Void> updateEntityProperties(String alfrescoNodeId, Map<String, Object> properties) {
        LOG.infof("STUB: updateEntityProperties for node %s", alfrescoNodeId);
        return Uni.createFrom().voidItem();
    }

    @Override
    public Uni<Void> applyAspect(String alfrescoNodeId, String aspectName, Map<String, Object> properties) {
        LOG.infof("STUB: applyAspect %s on node %s", aspectName, alfrescoNodeId);
        return Uni.createFrom().voidItem();
    }
}
