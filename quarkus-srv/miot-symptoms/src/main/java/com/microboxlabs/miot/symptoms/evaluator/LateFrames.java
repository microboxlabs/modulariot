package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.Map;

/**
 * Where the evaluator hands a signal older than the newest one it applied for the vehicle and organization. The
 * symptoms do not run on it; a hook may still use it, as the lost-signal detector does for backfill.
 */
public interface LateFrames {

    LateFrames NONE = (tenantCode, assetId, at, newest, signal) -> {
    };

    /**
     * @param newest the organization's watermark for the vehicle, after {@code at}
     * @param signal the signal as the organization's rules read it
     */
    void late(String tenantCode, String assetId, Instant at, Instant newest, Map<String, Object> signal);
}
