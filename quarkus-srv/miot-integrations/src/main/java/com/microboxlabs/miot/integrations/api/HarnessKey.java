package com.microboxlabs.miot.integrations.api;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;

/** The {@code miot.harness.provider-key} check shared by the {@code /internal} harness endpoints. */
final class HarnessKey {

    static final String HEADER = "x-miot-harness-key";

    private HarnessKey() {
    }

    /** The response to send instead of serving the call, or empty when the key matches. */
    static Optional<Response> refusal(Optional<String> configured, String presented) {
        String key = configured.orElse("");
        if (key.isBlank()) {
            return Optional.of(error(Response.Status.SERVICE_UNAVAILABLE,
                    "The harness key is not configured"));
        }
        if (!DashboardCredentialsResource.keyAccepted(key, presented)) {
            return Optional.of(error(Response.Status.UNAUTHORIZED, "Unauthorized"));
        }
        return Optional.empty();
    }

    static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .entity(Map.of("error", message))
                .build();
    }
}
