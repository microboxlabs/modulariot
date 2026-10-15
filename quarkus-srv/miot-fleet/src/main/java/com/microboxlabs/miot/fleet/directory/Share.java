package com.microboxlabs.miot.fleet.directory;

/** The most frequent value in a set of trips: how many of {@code total} trips had it. */
public record Share(String value, int count, int total) {

    public double ratio() {
        return total == 0 ? 0 : (double) count / total;
    }
}
