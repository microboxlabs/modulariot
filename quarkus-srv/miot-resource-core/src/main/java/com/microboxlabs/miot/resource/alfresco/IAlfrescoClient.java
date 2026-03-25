package com.microboxlabs.miot.resource.alfresco;

import com.microboxlabs.miot.resource.event.EntityType;
import io.smallrye.mutiny.Uni;
import java.util.Map;
import java.util.UUID;

public interface IAlfrescoClient {

    Uni<String> createEntityFolder(String clientId, EntityType entityType, UUID entityId,
                                   Map<String, Object> properties);

    Uni<Void> updateEntityProperties(String alfrescoNodeId, Map<String, Object> properties);

    Uni<Void> applyAspect(String alfrescoNodeId, String aspectName, Map<String, Object> properties);
}
