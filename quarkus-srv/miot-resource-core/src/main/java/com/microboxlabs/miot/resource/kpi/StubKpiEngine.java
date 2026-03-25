package com.microboxlabs.miot.resource.kpi;

import com.microboxlabs.miot.resource.event.EntityType;
import com.microboxlabs.miot.resource.score.EntityScore;
import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
@DefaultBean
public class StubKpiEngine implements IKpiEngine {

    private static final Logger LOG = Logger.getLogger(StubKpiEngine.class);

    @Override
    public Uni<List<EntityScore>> computeScores(String clientId, EntityType entityType, UUID entityId) {
        LOG.infof("STUB: computeScores for %s/%s/%s", clientId, entityType, entityId);
        return Uni.createFrom().item(Collections.emptyList());
    }

    @Override
    public Uni<EntityScore> getCompositeScore(String clientId, EntityType entityType, UUID entityId) {
        LOG.infof("STUB: getCompositeScore for %s/%s/%s", clientId, entityType, entityId);
        return Uni.createFrom().nullItem();
    }
}
