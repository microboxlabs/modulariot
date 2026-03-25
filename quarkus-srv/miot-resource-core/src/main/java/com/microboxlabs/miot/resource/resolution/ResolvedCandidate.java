package com.microboxlabs.miot.resource.resolution;

import java.util.Map;
import java.util.UUID;

public record ResolvedCandidate(
    UUID entityId,
    String entityType,
    double matchScore,
    Map<String, Object> attributes
) {}
