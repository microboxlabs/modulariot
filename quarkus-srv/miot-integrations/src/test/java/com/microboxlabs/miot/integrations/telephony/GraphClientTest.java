package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GraphClientTest {

    @Test
    void pacesBothReportsAndTheirPagesTogether() throws Exception {
        StubHttp http = new StubHttp();
        List<Long> sentAt = new ArrayList<>();
        GraphClient graph = new GraphClient(request -> {
            sentAt.add(System.nanoTime());
            return http.send(request);
        }, URI.create("https://graph.test"));
        Instant from = Instant.parse("2026-11-04T10:00:00Z");

        graph.pstnCalls(Map.of(), from, from.plusSeconds(60));
        graph.directRoutingCalls(Map.of(), from, from.plusSeconds(60));
        graph.next(Map.of(), "https://graph.test/next");

        for (int i = 1; i < sentAt.size(); i++) {
            assertTrue(sentAt.get(i) - sentAt.get(i - 1) >= GraphClient.REQUEST_INTERVAL.toNanos() * 9 / 10,
                    "tenant reports and pagination share a request budget");
        }
    }
}
