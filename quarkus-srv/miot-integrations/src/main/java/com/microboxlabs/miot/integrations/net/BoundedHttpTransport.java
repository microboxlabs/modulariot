package com.microboxlabs.miot.integrations.net;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** A deadline covering headers and body, with a byte limit enforced before buffering. */
public final class BoundedHttpTransport {
    private BoundedHttpTransport() {
    }

    public static HttpResponse<String> send(
            HttpClient client, HttpRequest request, int maxBytes, Duration timeout)
            throws IOException, InterruptedException {
        long timeoutMillis = timeout.toMillis();
        if (maxBytes < 1 || timeoutMillis < 1) {
            throw new IllegalArgumentException("Positive response and timeout limits are required");
        }
        var pending = client.sendAsync(request, ignored -> new LimitedBody(maxBytes));
        try {
            return pending.get(timeoutMillis, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            pending.cancel(true);
            throw new IOException("Operation response deadline exceeded", e);
        } catch (InterruptedException e) {
            pending.cancel(true);
            throw e;
        } catch (ExecutionException e) {
            throw new IOException("Operation response could not be read", e.getCause());
        }
    }

    private static final class LimitedBody implements HttpResponse.BodySubscriber<String> {
        private final HttpResponse.BodySubscriber<String> delegate =
                HttpResponse.BodySubscribers.ofString(StandardCharsets.UTF_8);
        private int remaining;
        private Flow.Subscription subscription;
        private boolean failed;

        LimitedBody(int maxBytes) {
            remaining = maxBytes;
        }

        @Override
        public CompletionStage<String> getBody() {
            return delegate.getBody();
        }

        @Override
        public void onSubscribe(Flow.Subscription next) {
            subscription = next;
            delegate.onSubscribe(next);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            if (failed) return;
            for (ByteBuffer buffer : buffers) {
                if (buffer.remaining() > remaining) {
                    failed = true;
                    subscription.cancel();
                    delegate.onError(new IOException("Operation response byte limit exceeded"));
                    return;
                }
                remaining -= buffer.remaining();
            }
            delegate.onNext(buffers);
        }

        @Override
        public void onError(Throwable error) {
            if (!failed) {
                failed = true;
                delegate.onError(error);
            }
        }

        @Override
        public void onComplete() {
            if (!failed) delegate.onComplete();
        }
    }
}
