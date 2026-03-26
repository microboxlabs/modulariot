package com.microboxlabs.miot.resource.dto;

public record StatusChangeRequest(
    String status,
    String reason
) {}
