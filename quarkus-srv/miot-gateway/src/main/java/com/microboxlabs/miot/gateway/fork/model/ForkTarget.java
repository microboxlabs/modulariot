package com.microboxlabs.miot.gateway.fork.model;

/**
 * Resolved forward target — url is pre-built from mirrorHost + mirrorPath at startup.
 */
public record ForkTarget(
        String id,
        String url,
        int timeout
) {}
