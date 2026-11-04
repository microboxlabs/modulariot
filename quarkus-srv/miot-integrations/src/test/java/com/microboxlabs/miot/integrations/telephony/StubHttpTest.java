package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.net.http.HttpRequest;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.Flow;
import org.junit.jupiter.api.Test;

class StubHttpTest {
    @Test
    void waitsForAsynchronousCompletionAndDecodesUtf8AcrossBuffers() throws Exception {
        try (var worker = Executors.newSingleThreadExecutor()) {
            byte[] bytes = "é".getBytes(StandardCharsets.UTF_8);
            var publisher = HttpRequest.BodyPublishers.fromPublisher(subscriber -> subscriber.onSubscribe(new Flow.Subscription() {
                @Override public void request(long n) {
                    worker.submit(() -> {
                        subscriber.onNext(ByteBuffer.wrap(bytes, 0, 1));
                        subscriber.onNext(ByteBuffer.wrap(bytes, 1, 1));
                        subscriber.onComplete();
                    });
                }
                @Override public void cancel() {
                    // The publisher finishes after its single, bounded response.
                }
            }));
            var http = new StubHttp();
            http.send(HttpRequest.newBuilder(URI.create("https://example.test")).POST(publisher).build());
            assertEquals("é", http.last().body());
        }
    }

    @Test
    void propagatesPublisherFailuresInsteadOfRecordingAPartialBody() {
        var failure = new IllegalStateException("Synthetic publisher failure");
        var publisher = HttpRequest.BodyPublishers.fromPublisher(subscriber -> subscriber.onSubscribe(new Flow.Subscription() {
            @Override public void request(long n) { subscriber.onError(failure); }
            @Override public void cancel() {
                // The publisher has already failed.
            }
        }));
        var request = HttpRequest.newBuilder(URI.create("https://example.test")).POST(publisher).build();
        var http = new StubHttp();
        var error = assertThrows(IllegalStateException.class, () -> http.send(request));
        assertSame(failure, error.getCause().getCause());
    }
}
