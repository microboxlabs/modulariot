package com.microboxlabs.miot.integrations.telephony;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Flow;
import javax.net.ssl.SSLSession;

/** A {@link TelephonyHttp} with canned replies by path prefix. Records each request and its body. */
public final class StubHttp implements TelephonyHttp {

    public record Seen(HttpRequest request, String body) {
        public String path() {
            return request.uri().getRawPath();
        }

        public String header(String name) {
            return request.headers().firstValue(name).orElse(null);
        }
    }

    private record Reply(int status, String body) {
    }

    private final Map<String, Reply> replies = new LinkedHashMap<>();
    private final List<Seen> seen = new ArrayList<>();
    private IOException failure;

    /** {@code pathPrefix} is a path prefix, or a method and a path prefix such as {@code "POST /v2/x"}. */
    public StubHttp reply(String pathPrefix, int status, String body) {
        replies.put(pathPrefix, new Reply(status, body));
        return this;
    }

    public StubHttp failWith(IOException failure) {
        this.failure = failure;
        return this;
    }

    public List<Seen> seen() {
        return seen;
    }

    public Seen last() {
        return seen.isEmpty() ? null : seen.get(seen.size() - 1);
    }

    @Override
    public HttpResponse<String> send(HttpRequest request) throws IOException {
        seen.add(new Seen(request, body(request)));
        if (failure != null) {
            throw failure;
        }
        String path = request.uri().getRawPath();
        String keyed = request.method() + " " + path;
        Reply reply = replies.entrySet().stream()
                .filter(e -> path.startsWith(e.getKey()) || keyed.startsWith(e.getKey()))
                .map(Map.Entry::getValue).findFirst().orElse(new Reply(404, "{}"));
        return new Response(request, reply.status(), reply.body());
    }

    private static String body(HttpRequest request) {
        if (request.bodyPublisher().isEmpty()) {
            return null;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CompletableFuture<String> completed = new CompletableFuture<>();
        request.bodyPublisher().get().subscribe(new Flow.Subscriber<>() {
            @Override
            public void onSubscribe(Flow.Subscription s) {
                s.request(Long.MAX_VALUE);
            }

            @Override
            public void onNext(ByteBuffer item) {
                byte[] bytes = new byte[item.remaining()];
                item.get(bytes);
                out.writeBytes(bytes);
            }

            @Override
            public void onError(Throwable throwable) {
                completed.completeExceptionally(throwable);
            }

            @Override
            public void onComplete() {
                completed.complete(out.toString(StandardCharsets.UTF_8));
            }
        });
        try {
            return completed.get(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while reading the stub request body", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("Could not read the stub request body", e);
        }
    }

    private record Response(HttpRequest request, int statusCode, String body) implements HttpResponse<String> {
        @Override
        public Optional<HttpResponse<String>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(Map.of(), (a, b) -> true);
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_1_1;
        }
    }
}
