package com.microboxlabs.miot.fleet.directory;

/** A document's state today: not loaded, valid, due within 30 days, or past its date. */
public enum DocumentStatus {
    MISSING, VALID, EXPIRING, EXPIRED
}
