package com.microboxlabs.miot.symptoms.catalog.domain;

/**
 * MAJOR: source, activation or measure changed. MINOR: thresholds, lifecycle,
 * recurrence or a level turned on or off. PATCH: only the response changed.
 * Declared from smallest to largest.
 */
public enum VersionBump {
    PATCH,
    MINOR,
    MAJOR
}
