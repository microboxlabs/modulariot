package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;

public record GpsWebhookTestResponse(
        boolean success,
        Integer statusCode,
        String message,
        OffsetDateTime testedAt) {
}
