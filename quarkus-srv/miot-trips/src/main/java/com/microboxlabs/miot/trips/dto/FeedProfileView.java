package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.FeedProfile;
import java.time.OffsetDateTime;
import java.util.List;

public record FeedProfileView(
        String feedKey,
        String name,
        List<FeedProfile.StagePlan> stages,
        String arrivalStage,
        List<String> requiredResources,
        boolean registersResources,
        boolean active,
        int openServices,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static FeedProfileView of(FeedProfile p, int openServices) {
        return new FeedProfileView(p.feedKey(), p.name(), p.stages(), p.arrivalStage(),
                List.copyOf(p.requiredResources()), p.registersResources(), p.active(), openServices, p.updatedAt(), p.updatedBy());
    }
}
