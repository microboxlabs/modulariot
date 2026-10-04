package com.microboxlabs.miot.symptoms.catalog.domain;

/** Where a source field's value comes from. */
public enum FieldOrigin {
    DEVICE,
    TRIP,
    VEHICLE,
    ROAD_NETWORK,
    ZONES,
    TENANT_SETTINGS,
    CALCULATED,
    CONNECTION
}
