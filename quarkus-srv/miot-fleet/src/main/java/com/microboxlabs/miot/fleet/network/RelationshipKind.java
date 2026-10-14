package com.microboxlabs.miot.fleet.network;

/** A relationship between two organizations, inferred from evidence on shared assets. */
public enum RelationshipKind {
    /** An operator works with a carrier's assets. */
    OPERATION,
    /** A provider's GPS reports a carrier's assets. */
    GPS_SERVICE
}
