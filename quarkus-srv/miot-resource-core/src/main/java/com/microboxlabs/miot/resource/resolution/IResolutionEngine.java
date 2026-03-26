package com.microboxlabs.miot.resource.resolution;

import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.Map;

public interface IResolutionEngine {

    Uni<List<ResolvedCandidate>> resolve(String clientId, String profileCode, Map<String, Object> context);
}
