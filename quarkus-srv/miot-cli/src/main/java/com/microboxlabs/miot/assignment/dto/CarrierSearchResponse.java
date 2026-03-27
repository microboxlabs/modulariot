package com.microboxlabs.miot.assignment.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CarrierSearchResponse(
        List<CarrierCandidate> carriers
) {

    public record CarrierCandidate(
            Long id,
            UUID entityId,
            String externalId,
            String name,
            String rut,
            String status,
            boolean active,
            Map<String, Object> calculatedFields
    ) {}
}
