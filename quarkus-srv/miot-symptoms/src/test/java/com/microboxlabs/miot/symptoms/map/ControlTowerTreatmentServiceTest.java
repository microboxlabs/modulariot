package com.microboxlabs.miot.symptoms.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.mutiny.Uni;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ControlTowerTreatmentServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final List<String> CLIENTS = List.of("client-a", "client-child");

    /** Symptom 7 is client-child's; trip T1 on asset AB12 is visible to it. */
    private static final class FakeReads implements TreatmentReads {
        final List<String> calls = new ArrayList<>();
        Map<Long, String> owners = Map.of(7L, "client-child");
        JsonNode treatment = JSON.createObjectNode().put("status", 200)
                .set("data", JSON.createObjectNode().set("symptom_info", JSON.createObjectNode().put("id", 7)));
        JsonNode signals = JSON.createObjectNode().put("status", 200)
                .set("data", JSON.createObjectNode().put("type", "FeatureCollection").set("features",
                        JSON.createArrayNode().add(JSON.createObjectNode().put("geometry", "0101"))));
        RuntimeException failure;

        private Uni<Optional<JsonNode>> owned(String call, String clientId, long symptomId, JsonNode answer) {
            calls.add(call + " " + clientId + " " + symptomId);
            if (failure != null) {
                return Uni.createFrom().failure(failure);
            }
            return Uni.createFrom().item(clientId.equals(owners.get(symptomId)) ? Optional.of(answer)
                    : Optional.empty());
        }

        @Override
        public Uni<Optional<JsonNode>> treatment(String clientId, long symptomId) {
            return owned("treatment", clientId, symptomId, treatment);
        }

        @Override
        public Uni<Optional<JsonNode>> signals(String clientId, long symptomId) {
            return owned("signals", clientId, symptomId, signals);
        }

        @Override
        public Uni<Optional<JsonNode>> tripPositions(String tripId, String assetId, String clientId, int limit) {
            calls.add("positions " + tripId + " " + assetId + " " + clientId + " " + limit);
            if (!"T1".equals(tripId) || !"AB12".equals(assetId) || !"client-child".equals(clientId)) {
                return Uni.createFrom().item(Optional.empty());
            }
            return Uni.createFrom().item(Optional.of(JSON.createArrayNode().add(JSON.createObjectNode()
                    .put("assetid", "AB12").put("longitude", -70.6).put("latitude", -33.4))));
        }

        @Override
        public Uni<JsonNode> assetPositions(String assetId, Instant from, Instant to, String clientId, int limit) {
            calls.add("asset " + assetId + " " + from + " " + to + " " + clientId + " " + limit);
            if (!"client-child".equals(clientId)) {
                return Uni.createFrom().item(JSON.createArrayNode());
            }
            return Uni.createFrom().item(JSON.createArrayNode().add(JSON.createObjectNode().put("assetid", assetId)));
        }
    }

    private final FakeReads reads = new FakeReads();
    private final ControlTowerTreatmentService service = new ControlTowerTreatmentService(reads);

    private static JsonNode await(Uni<JsonNode> call) {
        return call.await().indefinitely();
    }

    @Test
    void eachClientIsTriedInTurnUntilOneHoldsTheSymptom() {
        JsonNode data = await(service.treatment(CLIENTS, "7"));
        assertEquals(7, data.path("symptom_info").path("id").asInt());
        assertEquals(List.of("treatment client-a 7", "treatment client-child 7"), reads.calls);
    }

    @Test
    void anotherOrganizationsSymptomIsNotFound() {
        Uni<JsonNode> call = service.treatment(List.of("client-a"), "7");
        assertThrows(NoSuchElementException.class, () -> await(call));
        Uni<JsonNode> signals = service.signals(List.of("client-a"), "7");
        assertThrows(NoSuchElementException.class, () -> await(signals));
        assertEquals(List.of("treatment client-a 7", "signals client-a 7"), reads.calls);
    }

    @Test
    void anEmptyTreatmentIsNotFound() {
        reads.treatment = JSON.createObjectNode().put("status", 204).set("data", JSON.createObjectNode());
        Uni<JsonNode> call = service.treatment(CLIENTS, "7");
        assertThrows(NoSuchElementException.class, () -> await(call));
    }

    @Test
    void aFunctionErrorIsUnavailable() {
        reads.treatment = JSON.createObjectNode().put("status", 500).put("message", "Unexpected error: boom");
        Uni<JsonNode> call = service.treatment(CLIENTS, "7");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertTrue(!e.getMessage().contains("boom"));
    }

    @Test
    void aDatabaseFailureIsUnavailable() {
        reads.failure = new IllegalStateException("connection refused");
        Uni<JsonNode> call = service.signals(CLIENTS, "7");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertEquals("The GPS database did not answer", e.getMessage());
    }

    @Test
    void aNonNumericSymptomIdIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.treatment(CLIENTS, "7 OR 1=1"));
        assertTrue(reads.calls.isEmpty());
    }

    @Test
    void signalsAreTheFeatureCollection() {
        JsonNode data = await(service.signals(CLIENTS, "7"));
        assertEquals("FeatureCollection", data.path("type").asText());
        assertEquals("0101", data.path("features").get(0).path("geometry").asText());
    }

    @Test
    void noSignalsIsAnEmptyFeatureCollection() {
        reads.signals = JSON.createObjectNode().put("status", 200).put("data", "[]");
        JsonNode data = await(service.signals(CLIENTS, "7"));
        assertEquals("FeatureCollection", data.path("type").asText());
        assertTrue(data.path("features").isArray() && data.path("features").isEmpty());
    }

    @Test
    void signalsWithoutFeaturesHaveAnEmptyList() {
        reads.signals = JSON.createObjectNode().put("status", 200).set("data",
                JSON.createObjectNode().put("type", "FeatureCollection").putNull("features"));
        JsonNode data = await(service.signals(CLIENTS, "7"));
        assertTrue(data.path("features").isArray() && data.path("features").isEmpty());
    }

    @Test
    void tripPositionsAreCappedAndAnUnknownTripIsNotFound() {
        JsonNode positions = await(service.tripPositions(CLIENTS, " T1 ", "AB12"));
        assertEquals("AB12", positions.get(0).path("assetid").asText());
        assertEquals("positions T1 AB12 client-child " + ControlTowerTreatmentService.MAX_POSITIONS,
                reads.calls.get(1));

        Uni<JsonNode> other = service.tripPositions(CLIENTS, "T2", "AB12");
        assertThrows(NoSuchElementException.class, () -> await(other));
        assertThrows(IllegalArgumentException.class, () -> service.tripPositions(CLIENTS, "T1", " "));
    }

    @Test
    void assetPositionsAreReadForTheRangeAndCapped() {
        Instant from = Instant.parse("2026-10-22T02:00:00Z");
        Instant to = Instant.parse("2026-10-22T03:30:00Z");

        JsonNode positions = await(service.assetPositions(CLIENTS, " DEMO01 ", from, to));

        assertEquals("DEMO01", positions.get(0).path("assetid").asText());
        assertEquals("asset DEMO01 " + from + " " + to + " client-child " + ControlTowerTreatmentService.MAX_POSITIONS,
                reads.calls.get(1), "the first client id without the asset mapped reads nothing");
        assertTrue(await(service.assetPositions(List.of("client-a"), "DEMO01", from, to)).isEmpty());
        assertThrows(IllegalArgumentException.class, () -> service.assetPositions(CLIENTS, " ", from, to));
    }

    @Test
    void aRangeIsReadWithItsOffsetAndBounded() {
        JsonNode positions = await(service.rangePositions(CLIENTS, "DEMO01", "2026-10-22T00:00:00-03:00",
                "2026-10-23T23:59:59-03:00"));

        assertEquals("DEMO01", positions.get(0).path("assetid").asText());
        assertEquals("asset DEMO01 2026-10-22T03:00:00Z 2026-10-24T02:59:59Z client-child "
                + ControlTowerTreatmentService.MAX_POSITIONS, reads.calls.get(1));
        assertEquals(1, await(service.rangePositions(CLIENTS, "DEMO01", "2026-10-15T00:00:00Z",
                "2026-10-22T00:00:00Z")).size(), "seven days is the limit");
    }

    @Test
    void aBadRangeIsRefusedBeforeReading() {
        assertThrows(IllegalArgumentException.class,
                () -> service.rangePositions(CLIENTS, "DEMO01", "2026-10-23T00:00:00Z", "2026-10-22T00:00:00Z"));
        assertThrows(IllegalArgumentException.class,
                () -> service.rangePositions(CLIENTS, "DEMO01", "2026-10-22T00:00:00Z", "2026-10-22T00:00:00Z"));
        assertThrows(IllegalArgumentException.class,
                () -> service.rangePositions(CLIENTS, "DEMO01", "2026-10-15T00:00:00Z", "2026-10-22T00:00:01Z"));
        assertThrows(IllegalArgumentException.class,
                () -> service.rangePositions(CLIENTS, "DEMO01", "2026-10-22 00:00", "2026-10-23T00:00:00Z"));
        assertThrows(IllegalArgumentException.class,
                () -> service.rangePositions(CLIENTS, "DEMO01", null, "2026-10-23T00:00:00Z"));
        assertTrue(reads.calls.isEmpty());
    }

    @Test
    void withoutClientIdsNothingIsFound() {
        Uni<JsonNode> call = service.treatment(List.of(), "7");
        assertThrows(NoSuchElementException.class, () -> await(call));
        assertTrue(reads.calls.isEmpty());
    }

    @Test
    void withoutADatabaseEverythingIsUnavailable() {
        ControlTowerTreatmentService none = new ControlTowerTreatmentService((TreatmentReads) null);
        Uni<JsonNode> call = none.treatment(CLIENTS, "7");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertEquals("GPS data is not configured", e.getMessage());
    }
}
