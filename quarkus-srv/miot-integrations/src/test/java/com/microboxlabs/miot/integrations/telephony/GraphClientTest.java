package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class GraphClientTest {

    @Test
    void aQueuedInteractiveRequestCanBeCancelledWhileAnotherSendIsBlocked() throws Exception {
        CountDownLatch sending = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger requests = new AtomicInteger();
        StubHttp http = new StubHttp();
        GraphClient graph = new GraphClient(request -> {
            requests.incrementAndGet();
            sending.countDown();
            release.await();
            return http.send(request);
        }, URI.create("https://graph.test"));
        Instant from = Instant.parse("2026-11-04T10:00:00Z");
        CompletableFuture<Boolean> cancelled = new CompletableFuture<>();
        Thread interactive = new Thread(() -> {
            try {
                graph.directRoutingCalls(Map.of(), from, from.plusSeconds(60));
                cancelled.complete(false);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                cancelled.complete(true);
            } catch (java.io.IOException e) {
                cancelled.completeExceptionally(e);
            }
        });
        try (var workers = Executors.newSingleThreadExecutor()) {
            var background = workers.submit(() -> graph.pstnCalls(Map.of(), from, from.plusSeconds(60)));
            try {
                assertTrue(sending.await(5, TimeUnit.SECONDS));
                interactive.start();
                interactive.interrupt();

                assertTrue(cancelled.get(5, TimeUnit.SECONDS));
                assertEquals(1, requests.get(), "the cancelled request never reaches Graph");
            } finally {
                release.countDown();
                interactive.join(5000);
            }
            background.get(5, TimeUnit.SECONDS);
        }
    }

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
