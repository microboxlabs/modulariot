package com.microboxlabs.miot.fleet.directory;

/** Where a field's value comes from. MANUAL wins over the integrations until it is cleared. */
public enum FieldSource {
    SIGNAL, TRIP, MANUAL, NONE
}
