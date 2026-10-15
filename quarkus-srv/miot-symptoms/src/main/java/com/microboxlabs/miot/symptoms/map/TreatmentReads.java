package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.databind.JsonNode;
import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.Optional;

/** The GPS database reads behind the treatment page. */
public interface TreatmentReads {

    /** The client id that holds the symptom, when it is one of {@code clientIds}. */
    Uni<Optional<String>> symptomClient(long symptomId, List<String> clientIds);

    /** The whole answer of {@code api_modular_treatments_info_general}: {@code status}, {@code message}, {@code data}. */
    Uni<JsonNode> treatment(String clientId, long symptomId);

    /** The whole answer of {@code api_modular_treatment_symptoms_signals_map}. */
    Uni<JsonNode> signals(String clientId, long symptomId);

    /**
     * The asset's positions during the trip, oldest first, at most {@code limit}. Empty when the trip does not
     * exist for that asset or the asset is not one of {@code clientIds}.
     */
    Uni<Optional<JsonNode>> tripPositions(String tripId, String assetId, List<String> clientIds, int limit);
}
