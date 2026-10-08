package com.microboxlabs.miot.symptoms.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ControlTowerMapServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Answers every function with {@link #response} and records the calls. */
    private static final class FakeRpc implements GpsRpcApi {
        final List<String> calls = new ArrayList<>();
        RpcResponse response = new RpcResponse(200, "ok", JSON.createArrayNode().add("row"));
        int failWith;
        RuntimeException transportFailure;

        private Uni<RpcResponse> answer(String call) {
            calls.add(call);
            if (transportFailure != null) {
                return Uni.createFrom().failure(transportFailure);
            }
            return failWith != 0 ? Uni.createFrom().failure(new WebApplicationException(failWith))
                    : Uni.createFrom().item(response);
        }

        @Override
        public Uni<RpcResponse> positions(String authorization, boolean all) {
            return answer("positions " + authorization + " all=" + all);
        }

        @Override
        public Uni<RpcResponse> summary(String authorization) {
            return answer("summary " + authorization);
        }

        @Override
        public Uni<RpcResponse> conditions(String authorization, String from, String to) {
            return answer("conditions " + authorization + " " + from + " " + to);
        }

        @Override
        public Uni<JsonNode> symptoms(String authorization, java.util.Map<String, String> filters) {
            calls.add("symptoms " + authorization + " " + new java.util.TreeMap<>(filters));
            return Uni.createFrom().item(symptomsBody);
        }

        JsonNode symptomsBody = JSON.createObjectNode().put("status", 200).put("total_rows", 0);
    }

    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-08T12:00:00Z");

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private final FakeRpc rpc = new FakeRpc();
    private final MutableClock clock = new MutableClock();
    private final List<String> tokensAskedFor = new ArrayList<>();

    private ControlTowerMapService service(Optional<String> url) {
        return new ControlTowerMapService(clientId -> {
            tokensAskedFor.add(clientId);
            if ("no-app".equals(clientId)) {
                return Uni.createFrom().failure(new IllegalStateException("The organization has no Auth0 application"));
            }
            return Uni.createFrom().item(new IssuedToken("token-" + clientId, Instant.now().plusSeconds(3600)));
        }, url, () -> rpc, clock);
    }

    private final ControlTowerMapService map = service(Optional.of("http://pgrest.test"));

    private static JsonNode await(Uni<JsonNode> call) {
        return call.await().indefinitely();
    }

    @Test
    void eachCallCarriesTheOrganizationsToken() {
        assertEquals("row", await(map.positions("client-a")).get(0).asText());
        await(map.summary("client-b"));

        assertEquals(List.of("positions Bearer token-client-a all=true", "summary Bearer token-client-b"), rpc.calls);
        assertEquals(List.of("client-a", "client-b"), tokensAskedFor);
    }

    @Test
    void noDataIsAnEmptyResult() {
        rpc.response = new GpsRpcApi.RpcResponse(204, "No data available", JSON.createArrayNode());
        assertTrue(await(map.positions("client-a")).isEmpty());

        rpc.response = new GpsRpcApi.RpcResponse(204, "No data available", null);
        JsonNode counts = await(map.conditions("client-a", null, null));
        assertTrue(counts.isObject() && counts.isEmpty());
    }

    @Test
    void conditionsPassTheRangeOnlyWhenBothDatesAreGiven() {
        await(map.conditions("client-a", "2026-10-01T00:00:00Z", "2026-10-07"));
        await(map.conditions("client-a", "", null));

        assertEquals(List.of("conditions Bearer token-client-a 2026-10-01T00:00:00Z 2026-10-07",
                "conditions Bearer token-client-a null null"), rpc.calls);
        assertThrows(IllegalArgumentException.class, () -> map.conditions("client-a", "2026-10-01", null));
        assertThrows(IllegalArgumentException.class, () -> map.conditions("client-a", "yesterday", "today"));
    }

    @Test
    void aFunctionErrorIsUnavailableWithoutItsMessage() {
        rpc.response = new GpsRpcApi.RpcResponse(500, "Unexpected error: relation x does not exist", null);
        Uni<JsonNode> call = map.summary("client-a");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertTrue(!e.getMessage().contains("relation"));
    }

    @Test
    void anHttpErrorIsUnavailable() {
        rpc.failWith = 401;
        Uni<JsonNode> call = map.positions("client-a");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertTrue(e.getMessage().contains("401"));
    }

    @Test
    void anOrganizationWithoutAnApplicationIsUnavailable() {
        Uni<JsonNode> call = map.positions("no-app");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertEquals("The organization has no Auth0 application", e.getMessage());
        assertTrue(rpc.calls.isEmpty());
    }

    @Test
    void withoutAUrlNothingIsCalled() {
        Uni<JsonNode> call = service(Optional.of(" ")).positions("client-a");
        assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertTrue(tokensAskedFor.isEmpty());
        assertTrue(rpc.calls.isEmpty());
    }

    @Test
    void anAnswerIsReusedForFiveSecondsPerOrganization() {
        await(map.positions("client-a"));
        await(map.positions("client-a"));
        await(map.positions("client-b"));
        assertEquals(2, rpc.calls.size());

        clock.now = clock.now.plus(ControlTowerMapService.FRESH);
        await(map.positions("client-a"));
        assertEquals(3, rpc.calls.size());
    }

    @Test
    void aFailureIsNotReused() {
        rpc.failWith = 429;
        Uni<JsonNode> refused = map.summary("client-a");
        assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(refused));

        rpc.failWith = 0;
        assertEquals("row", await(map.summary("client-a")).get(0).asText());
        assertEquals(2, rpc.calls.size());
    }

    @Test
    void aTransportFailureIsUnavailable() {
        rpc.transportFailure = new jakarta.ws.rs.ProcessingException("Connection refused");
        Uni<JsonNode> call = map.positions("client-a");
        var e = assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
        assertEquals("The GPS database did not answer", e.getMessage());
    }

    @Test
    void symptomsTrimFiltersDropBlanksAndKeepTheWholeAnswer() {
        JsonNode page = await(map.symptoms("client-a",
                java.util.Map.of("p_asset_id", " AB12 ", "p_trip_id", "", "p_start_date_historic", "2026-10-01")));
        assertEquals(0, page.get("total_rows").asInt());
        assertEquals(List.of("symptoms Bearer token-client-a {p_asset_id=AB12, p_start_date_historic=2026-10-01}"),
                rpc.calls);
    }

    @Test
    void symptomsRefuseFiltersTheFunctionDoesNotOffer() {
        for (var filters : List.of(java.util.Map.of("p_client_id", "someone-else"),
                java.util.Map.of("p_client_id", ""), java.util.Map.of("p_icu_code", "3 OR 1=1"),
                java.util.Map.of("p_end_date_historic", "tomorrow"))) {
            assertThrows(IllegalArgumentException.class, () -> map.symptoms("client-a", filters), filters.toString());
        }
        assertTrue(rpc.calls.isEmpty());
    }

    @Test
    void symptomFiltersThatPrintAlikeAreCachedApart() {
        await(map.symptoms("client-a", java.util.Map.of("p_asset_id", "AB12, p_trip_id=T1")));
        await(map.symptoms("client-a", java.util.Map.of("p_asset_id", "AB12", "p_trip_id", "T1")));
        assertEquals(2, rpc.calls.size());
    }

    @Test
    void aSymptomsFunctionErrorIsUnavailable() {
        rpc.symptomsBody = JSON.createObjectNode().put("status", 500).put("message", "Unexpected error: boom");
        Uni<JsonNode> call = map.symptoms("client-a", java.util.Map.of());
        assertThrows(ControlTowerMapService.UnavailableException.class, () -> await(call));
    }
}
