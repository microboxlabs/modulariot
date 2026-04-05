package com.microboxlabs.miot.tracking.service;

import cl.streamhub.gps.model.AssetTrackingData;
import java.time.Instant;

public interface AssetTrackingService {

    void trackAsset(AssetTrackingData data, String requestId, Instant requestTimestamp);
}
