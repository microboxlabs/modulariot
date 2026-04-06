package com.microboxlabs.miot.tracking.persistence;

import com.google.common.geometry.S2CellId;
import com.google.common.geometry.S2LatLng;

/**
 * S2 geometry token generation for spatial indexing.
 */
public final class S2Util {

    private S2Util() {}

    /** Returns the compact hex S2 token at the given level. */
    public static String tokenAtLevel(double lat, double lon, int level) {
        validate(lat, lon, level);
        S2LatLng ll = S2LatLng.fromDegrees(lat, lon);
        return S2CellId.fromLatLng(ll).parent(level).toToken();
    }

    private static void validate(double lat, double lon, int level) {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw new IllegalArgumentException("lat/lon out of range");
        }
        if (level < 0 || level > 30) {
            throw new IllegalArgumentException("level must be between 0 and 30");
        }
    }
}
