package com.microboxlabs.miot.fleet.dto;

import java.math.BigDecimal;

public record CreateTrailerRequest(
    String externalId,
    String licensePlate,
    String trailerType,
    BigDecimal maxWeight,
    Integer axleCount
) {}
