package com.microboxlabs.miot.integrations.telephony;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Calls Microsoft Graph with an app token. Blocking. The address is server configuration
 * ({@code miot.integrations.graph.base-url}).
 */
@ApplicationScoped
public class GraphClient {

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")
            .withZone(ZoneOffset.UTC);

    private final TelephonyHttp http;
    private final URI baseUrl;
    static final Duration REQUEST_INTERVAL = Duration.ofMillis(250);
    private long lastRequestAt;
    private final ReentrantLock pacing = new ReentrantLock(true);

    @Inject
    public GraphClient(
            @ConfigProperty(name = "miot.integrations.graph.base-url", defaultValue = "https://graph.microsoft.com")
            URI baseUrl) {
        this(TelephonyHttp.network(), baseUrl);
    }

    public GraphClient(TelephonyHttp http, URI baseUrl) {
        this.http = http;
        this.baseUrl = baseUrl;
    }

    public URI baseUrl() {
        return baseUrl;
    }

    /** Whether a connection's base URL names this client's Graph (unset counts). */
    public boolean serves(URI connectionBaseUrl) {
        return connectionBaseUrl == null || trim(connectionBaseUrl.toString()).equals(trim(baseUrl.toString()));
    }

    /**
     * {@code GET /v1.0/communications/callRecords/getPstnCalls(fromDateTime=..,toDateTime=..)}: Calling Plans and
     * Operator Connect calls. Needs the application permission CallRecords.Read.All.
     *
     * @param auth the request headers of the app token, e.g. {@code Authorization}
     */
    public HttpResponse<String> pstnCalls(Map<String, String> auth, Instant from, Instant to)
            throws IOException, InterruptedException {
        return callRecords("getPstnCalls", auth, from, to);
    }

    /**
     * {@code GET /v1.0/communications/callRecords/getDirectRoutingCalls(fromDateTime=..,toDateTime=..)}: calls
     * through the organization's own carrier. Same permission as {@link #pstnCalls}.
     */
    public HttpResponse<String> directRoutingCalls(Map<String, String> auth, Instant from, Instant to)
            throws IOException, InterruptedException {
        return callRecords("getDirectRoutingCalls", auth, from, to);
    }

    private HttpResponse<String> callRecords(String function, Map<String, String> auth, Instant from, Instant to)
            throws IOException, InterruptedException {
        String path = "/v1.0/communications/callRecords/" + function + "(fromDateTime="
                + UTC.format(from.truncatedTo(ChronoUnit.SECONDS)) + ",toDateTime="
                + UTC.format(to.truncatedTo(ChronoUnit.SECONDS)) + ")";
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(trim(baseUrl.toString()) + path))
                .timeout(TelephonyHttp.TIMEOUT)
                .header("Accept", "application/json")
                .GET();
        auth.forEach(request::header);
        return send(request.build());
    }

    /**
     * Follows an {@code @odata.nextLink}. Only links on this client's Graph are followed, so the token
     * never goes elsewhere.
     *
     * @throws IllegalArgumentException for a link on another host
     */
    public HttpResponse<String> next(Map<String, String> auth, String nextLink)
            throws IOException, InterruptedException {
        URI uri = URI.create(nextLink);
        if (!trim(baseUrl.toString()).equals(uri.getScheme() + "://" + uri.getRawAuthority())) {
            throw new IllegalArgumentException("Graph returned a next link on another host");
        }
        HttpRequest.Builder request = HttpRequest.newBuilder(uri).timeout(TelephonyHttp.TIMEOUT)
                .header("Accept", "application/json").GET();
        auth.forEach(request::header);
        return send(request.build());
    }

    /** Bound aggregate Graph traffic across organizations, operators and report pages on this replica. */
    private HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException {
        pacing.lockInterruptibly();
        try {
            if (lastRequestAt != 0) {
                long pause = REQUEST_INTERVAL.toNanos() - (System.nanoTime() - lastRequestAt);
                if (pause > 0) {
                    TimeUnit.NANOSECONDS.sleep(pause);
                }
            }
            lastRequestAt = System.nanoTime();
            return http.send(request);
        } finally {
            pacing.unlock();
        }
    }

    private static String trim(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
