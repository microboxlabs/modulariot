package com.microboxlabs.miot.driver.dto;

public record UpdateDriverRequest(
    String firstName,
    String lastName,
    String rut,
    String phone,
    String mobilePhone,
    String email,
    String licenseNumber,
    String licenseCategory,
    String licenseExpires,
    String carrierExternalId,
    Boolean isOccasional,
    Boolean operationBlocked
) {}
