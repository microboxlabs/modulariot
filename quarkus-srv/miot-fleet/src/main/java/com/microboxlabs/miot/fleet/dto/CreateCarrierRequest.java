package com.microboxlabs.miot.fleet.dto;

public record CreateCarrierRequest(
    String externalId,
    String name,
    String rut,
    String transportLicense,
    String transportLicenseExpires
) {}
