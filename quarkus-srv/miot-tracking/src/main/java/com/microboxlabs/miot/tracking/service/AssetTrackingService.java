package com.microboxlabs.miot.tracking.service;

import cl.streamhub.gps.model.AssetTrackingData;
import java.time.Instant;
import java.util.concurrent.CompletionStage;

public interface AssetTrackingService {

    CompletionStage<Void> trackAsset(AssetTrackingData data, String requestId, Instant requestTimestamp);
}
