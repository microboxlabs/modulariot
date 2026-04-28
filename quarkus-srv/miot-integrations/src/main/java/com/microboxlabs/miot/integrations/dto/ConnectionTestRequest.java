package com.microboxlabs.miot.integrations.dto;

public record ConnectionTestRequest(
        String method,
        String path) {
}
