package com.microboxlabs.miot.symptoms.lostsignal;

import java.util.Locale;

/** The shadow map's grid: cells of {@value #CELL_DEGREES}° (about 5 km). */
public final class CoverageMap {

    static final double CELL_DEGREES = 0.05;

    private CoverageMap() {
    }

    /** The cell of a position, or null without one. */
    public static String cell(Double lat, Double lon) {
        if (lat == null || lon == null || (lat == 0 && lon == 0)) {
            return null;
        }
        return String.format(Locale.ROOT, "%d:%d", (long) Math.floor(lat / CELL_DEGREES),
                (long) Math.floor(lon / CELL_DEGREES));
    }
}
