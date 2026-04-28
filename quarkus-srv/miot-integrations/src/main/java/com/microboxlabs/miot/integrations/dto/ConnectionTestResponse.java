package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;

public record ConnectionTestResponse(
        boolean success,
        OffsetDateTime testedAt,
        String message) {
}
