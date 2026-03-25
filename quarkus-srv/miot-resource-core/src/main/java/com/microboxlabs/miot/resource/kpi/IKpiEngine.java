package com.microboxlabs.miot.resource.kpi;

import com.microboxlabs.miot.resource.event.EntityType;
import com.microboxlabs.miot.resource.score.EntityScore;
import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.UUID;

public interface IKpiEngine {

    Uni<List<EntityScore>> computeScores(String clientId, EntityType entityType, UUID entityId);

    Uni<EntityScore> getCompositeScore(String clientId, EntityType entityType, UUID entityId);
}
