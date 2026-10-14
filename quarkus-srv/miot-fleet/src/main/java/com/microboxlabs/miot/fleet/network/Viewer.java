package com.microboxlabs.miot.fleet.network;

/** The organization asking, and the client id its own GPS signals arrive with. */
public record Viewer(String organizationId, String clientId) {
}
