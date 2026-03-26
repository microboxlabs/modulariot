package com.microboxlabs.miot.driver.dto;

public record CreateDriverRequest(
    String externalId,
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
    boolean isOccasional,
    boolean operationBlocked
) {}
