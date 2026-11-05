package com.microboxlabs.miot.fleet.directory;

/** One asset's activity summed over a period. {@code activeDays} counts days with movement. */
public record ActivityTotals(double km, long engineSeconds, long idleSeconds, long movingSeconds, int activeDays) {

    public static final ActivityTotals NONE = new ActivityTotals(0, 0, 0, 0, 0);
}
