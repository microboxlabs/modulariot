package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.FeedProfile;
import java.util.List;

/** The rules of a feed; see {@link FeedProfile}. A missing {@code active} means true. */
public record FeedProfileRequest(
        String name,
        List<FeedProfile.StagePlan> stages,
        String arrivalStage,
        List<String> requiredResources,
        Boolean active) {
}
