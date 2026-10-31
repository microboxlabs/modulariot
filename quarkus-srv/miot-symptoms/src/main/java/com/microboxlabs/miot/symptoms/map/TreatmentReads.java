package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.databind.JsonNode;
import io.smallrye.mutiny.Uni;
import java.time.Instant;
import java.util.Optional;

/**
 * The GPS database reads behind the treatment page, each as one organization client id. The database maps that id to
 * the id its symptoms are stored under with {@code api_request_symptoms_client_id()}.
 */
public interface TreatmentReads {

    /**
     * The whole answer of {@code api_modular_treatments_info_general}: {@code status}, {@code message}, {@code data}.
     * Empty when the symptom is not the client's.
     */
    Uni<Optional<JsonNode>> treatment(String clientId, long symptomId);

    /**
     * The whole answer of {@code api_modular_treatment_symptoms_signals_map}. Empty when the symptom is not the
     * client's.
     */
    Uni<Optional<JsonNode>> signals(String clientId, long symptomId);

    Uni<Optional<JsonNode>> tripGeofences(String tripId, String clientId);

    /**
     * The asset's positions during the trip, oldest first, at most {@code limit}, sampled evenly over the trip. Empty
     * when the trip does not exist for that asset or the client may not see it.
     */
    Uni<Optional<JsonNode>> tripPositions(String tripId, String assetId, String clientId, int limit);

    /**
     * The asset's positions from {@code from} to {@code to}, oldest first, at most {@code limit}, sampled evenly. Only
     * the positions sent while the asset was mapped to the client; an empty array when there are none.
     */
    Uni<JsonNode> assetPositions(String assetId, Instant from, Instant to, String clientId, int limit);
}
