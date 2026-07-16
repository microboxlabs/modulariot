package com.microboxlabs.miot.integrations.calendar;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Minimal miot-calendar HTTP client for the two operations {@code calendar_sync}
 * needs — {@code patchByResource} and {@code cancel} (plus {@code listByResource}
 * to drive the cancel future-vs-past decision). Ported from ECM's
 * {@code MiotCalendarBookingsClient}; the wire contract (paths, JSON shapes,
 * status semantics) is identical — only the runtime moved off ECM.
 *
 * <p>Uses the JDK {@link HttpClient} like {@code RetransmitDeliveryJob}. Non-2xx
 * and network errors surface as {@link CalendarBookingsHttpException} carrying
 * the status; the executor decides benign-skip (404/409) vs retry (everything
 * else, including {@code -1} network errors).
 */
@ApplicationScoped
public class CalendarBookingsClient {

    // Paths are pinned by the miot-calendar API contract — not a deployment
    // choice — so hardcoding them (java:S1075) is deliberate: a configurable
    // path would let an operator point at an incompatible endpoint shape.
    @SuppressWarnings("java:S1075")
    private static final String BASE_PATH = "/api/v1/miot-calendar/bookings";
    private static final String X_USER_ID = "miot-integrations";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);

    private final Optional<String> baseUrl;
    private final Optional<String> token;
    private final HttpClient httpClient;

    @Inject
    CalendarBookingsClient(
            @ConfigProperty(name = "miot.integrations.calendar-sync.miot-calendar.base-url")
                    Optional<String> baseUrl,
            @ConfigProperty(name = "miot.integrations.calendar-sync.miot-calendar.token")
                    Optional<String> token) {
        this.baseUrl = baseUrl.filter(u -> !u.isBlank());
        this.token = token.filter(t -> !t.isBlank());
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    /** Test seam: the network methods are overridden in fakes, so no client is built. */
    protected CalendarBookingsClient() {
        this.baseUrl = Optional.of("http://calendar.test");
        this.token = Optional.empty();
        this.httpClient = null;
    }

    /** The worker only runs when a base URL is configured (else jobs would fail). */
    public boolean isConfigured() {
        return baseUrl.isPresent();
    }

    /**
     * Patch every booking of a resource in place: lifecycle status and/or a
     * shallow resource-data merge, addressed by external resource id. 200 = ok;
     * 404 = no booking (benign), 409 = status regression (benign), else retry.
     */
    public void patchByResource(String resourceId, UUID calendarId,
                                String targetStatus, Map<String, Object> resourceDataPatch) {
        JsonObject body = new JsonObject();
        if (targetStatus != null) {
            body.put("status", targetStatus);
        }
        if (resourceDataPatch != null && !resourceDataPatch.isEmpty()) {
            body.put("resourceData", new JsonObject(resourceDataPatch));
        }
        String url = base() + BASE_PATH + "/resource/" + enc(resourceId)
                + (calendarId != null ? "?calendarId=" + calendarId : "");
        HttpResponse<String> response = send("PATCH", url, body.encode());
        if (response.statusCode() != 200) {
            throw httpError("patchByResource", url, response);
        }
    }

    /**
     * Lists a resource's bookings with the fields the cancel decision needs (id,
     * calendar, slot date/time, status). 404 = no bookings (empty list). Scoped
     * to one calendar when {@code calendarId} is non-null (filtered client-side).
     */
    public List<BookingView> listByResource(String resourceId, UUID calendarId) {
        String url = base() + BASE_PATH + "/resource/" + enc(resourceId);
        HttpResponse<String> response = send("GET", url, null);
        if (response.statusCode() == 404) {
            return List.of();
        }
        if (response.statusCode() != 200) {
            throw httpError("listByResource", url, response);
        }
        return parseBookingViews(response.body(), calendarId, url);
    }

    /** Deletes a booking (future-slot cancel — releases capacity). 204/200 = ok. */
    public void cancel(UUID bookingId) {
        String url = base() + BASE_PATH + "/" + bookingId;
        HttpResponse<String> response = send("DELETE", url, null);
        if (response.statusCode() != 204 && response.statusCode() != 200) {
            throw httpError("cancel", url, response);
        }
    }

    // -------------------------------------------------------------- helpers

    private String base() {
        return baseUrl.orElseThrow(() -> new IllegalStateException(
                "miot.integrations.calendar-sync.miot-calendar.base-url is not configured"));
    }

    private HttpResponse<String> send(String method, String url, String body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(HTTP_TIMEOUT)
                .header("X-User-Id", X_USER_ID)
                .header("Content-Type", "application/json");
        token.ifPresent(t -> builder.header("Authorization", "Bearer " + t));
        HttpRequest.BodyPublisher publisher = body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body);
        builder.method(method, publisher);
        try {
            return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CalendarBookingsHttpException(-1,
                    "miot-calendar " + method + " " + url + " interrupted: " + e.getMessage());
        } catch (java.io.IOException e) {
            throw new CalendarBookingsHttpException(-1,
                    "miot-calendar " + method + " " + url + " io error: " + e.getMessage());
        }
    }

    private static List<BookingView> parseBookingViews(String body, UUID calendarId, String url) {
        JsonArray data = parseDataArray(body, url);
        if (data == null) {
            return List.of();
        }
        List<BookingView> out = new ArrayList<>(data.size());
        for (int i = 0; i < data.size(); i++) {
            BookingView view = toView(data.getJsonObject(i), calendarId);
            if (view != null) {
                out.add(view);
            }
        }
        return out;
    }

    private static BookingView toView(JsonObject booking, UUID calendarId) {
        if (booking == null) {
            return null;
        }
        String bookingCalendarId = booking.getString("calendarId");
        if (calendarId != null
                && (bookingCalendarId == null || !calendarId.toString().equalsIgnoreCase(bookingCalendarId))) {
            return null;
        }
        String id = booking.getString("id");
        JsonObject slot = booking.getJsonObject("slot");
        if (id == null || bookingCalendarId == null || slot == null) {
            return null;
        }
        String date = slot.getString("date");
        Integer hour = slot.getInteger("hour");
        Integer minutes = slot.getInteger("minutes");
        if (date == null || hour == null || minutes == null) {
            return null;
        }
        return new BookingView(UUID.fromString(id), UUID.fromString(bookingCalendarId),
                LocalDate.parse(date), hour, minutes, booking.getString("status"));
    }

    private static JsonArray parseDataArray(String body, String url) {
        if (body == null || body.isBlank()) {
            return null;
        }
        JsonObject obj;
        try {
            obj = new JsonObject(body);
        } catch (RuntimeException e) {
            throw new CalendarBookingsHttpException(200,
                    "miot-calendar response unparseable from " + url + ": " + e.getMessage());
        }
        JsonArray data = obj.getJsonArray("data");
        return (data == null || data.isEmpty()) ? null : data;
    }

    private static CalendarBookingsHttpException httpError(String op, String url, HttpResponse<String> response) {
        return new CalendarBookingsHttpException(response.statusCode(), String.format(
                "miot-calendar %s failed (url=%s, status=%d, body=%s)",
                op, url, response.statusCode(), response.body()));
    }

    private static String enc(String raw) {
        return URLEncoder.encode(raw, StandardCharsets.UTF_8);
    }

    /**
     * Lightweight view of a booking: just enough for the cancel-time
     * future-vs-past decision. {@code status} may be null on older bookings.
     */
    public record BookingView(UUID id, UUID calendarId, LocalDate slotDate,
                              int slotHour, int slotMinutes, String status) {
    }
}
