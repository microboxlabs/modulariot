package com.microboxlabs.miot.fleet.dto;

import java.math.BigDecimal;

public record CreateTruckRequest(
    String externalId,
    String licensePlate,
    String vin,
    String brand,
    String model,
    Integer year,
    BigDecimal maxWeight,
    BigDecimal volume,
    String truckType
) {}
