package com.microboxlabs.miot.fleet.network;

/**
 * Anything a GPS reports: a truck, a trailer, a decoy in the cargo. {@code id} is the asset id the signal carries;
 * {@code type} is the signal's free text.
 */
public record Asset(String id, String type, String label) {
}
