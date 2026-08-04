package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.jobs.JobHttpTrace;
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
import java.time.DateTimeException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

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

    private static final Logger LOG = Logger.getLogger(CalendarBookingsClient.class);

    // Paths are pinned by the miot-calendar API contract — not a deployment
    // choice — so hardcoding them (java:S1075) is deliberate: a configurable
    // path would let an operator point at an incompatible endpoint shape.
    @SuppressWarnings("java:S1075")
    private static final String BASE_PATH = "/api/v1/miot-calendar/bookings";
    @SuppressWarnings("java:S1075")
    private static final String SLOTS_PATH = "/api/v1/miot-calendar/slots";
    @SuppressWarnings("java:S1075")
    private static final String CALENDARS_PATH = "/api/v1/miot-calendar/calendars";
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
        patchByResource(resourceId, calendarId, targetStatus, resourceDataPatch, null, null);
    }

    /**
     * Full patch variant, additionally carrying the TMS-confirmation
     * {@code syncStatus} (PENDING/CONFIRMED/REJECTED — orthogonal to the
     * monotonic lifecycle {@code status}; null leaves it untouched) and its
     * optional detail. Overridden by test fakes — keep this the single method
     * that actually sends.
     */
    public void patchByResource(String resourceId, UUID calendarId,
                                String targetStatus, Map<String, Object> resourceDataPatch,
                                String syncStatus, String syncDetail) {
        JsonObject body = new JsonObject();
        if (targetStatus != null) {
            body.put("status", targetStatus);
        }
        if (resourceDataPatch != null && !resourceDataPatch.isEmpty()) {
            body.put("resourceData", new JsonObject(resourceDataPatch));
        }
        if (syncStatus != null) {
            body.put("syncStatus", syncStatus);
            if (syncDetail != null) {
                body.put("syncDetail", syncDetail);
            }
        }
        String url = base() + BASE_PATH + "/resource/" + enc(resourceId)
                + (calendarId != null ? "?calendarId=" + calendarId : "");
        HttpResponse<String> response = send("PATCH", url, body.encode());
        if (response.statusCode() != 200) {
            throw httpError("patchByResource", url, response);
        }
    }

    /**
     * Unassign every booking of a resource: reset to {@code PLANNED} and drop
     * {@code clearDataKeys} from {@code resource.data}, keeping the slot.
     *
     * <p>The sanctioned ASSIGNED → PLANNED regression, which a plain
     * {@link #patchByResource} cannot express — miot-calendar keeps status
     * patches strictly forward-only and carries each legal regression on its
     * own operation. 200 = ok; 404 = no booking, 409 = the booking is past
     * ASSIGNED; the caller decides what those mean.
     */
    public void unassignByResource(String resourceId, UUID calendarId, List<String> clearDataKeys) {
        JsonObject body = new JsonObject();
        if (clearDataKeys != null && !clearDataKeys.isEmpty()) {
            body.put("clearDataKeys", new JsonArray(clearDataKeys));
        }
        String url = base() + BASE_PATH + "/resource/" + enc(resourceId) + "/unassign"
                + (calendarId != null ? "?calendarId=" + calendarId : "");
        HttpResponse<String> response = send("POST", url, body.encode());
        if (response.statusCode() != 200) {
            throw httpError("unassignByResource", url, response);
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

    /**
     * Creates a booking at an explicit slot (the {@link CalendarSyncFeature#OP_ENSURE}
     * create-if-absent path). 201/200 = created; returns the new booking id. Ported
     * from ECM's {@code MiotCalendarBookingsClient#create} — same wire contract.
     */
    public UUID create(UUID calendarId, LocalDate slotDate, int slotHour, int slotMinutes,
                       String resourceId, String resourceType, Map<String, Object> resourceData) {
        JsonObject resource = new JsonObject().put("id", resourceId);
        if (resourceType != null) {
            resource.put("type", resourceType);
        }
        if (resourceData != null && !resourceData.isEmpty()) {
            resource.put("data", new JsonObject(resourceData));
        }
        JsonObject body = new JsonObject()
                .put("calendarId", calendarId.toString())
                .put("resource", resource)
                .put("slot", slotJson(slotDate, slotHour, slotMinutes));
        String url = base() + BASE_PATH;
        HttpResponse<String> response = send("POST", url, body.encode());
        if (response.statusCode() != 201 && response.statusCode() != 200) {
            throw httpError("create", url, response);
        }
        return parseBookingId(response.body(), url);
    }

    /** Re-slots an existing booking (the ensure re-plan path). 200 = ok. */
    public void move(UUID bookingId, LocalDate slotDate, int slotHour, int slotMinutes) {
        JsonObject body = new JsonObject().put("slot", slotJson(slotDate, slotHour, slotMinutes));
        String url = base() + BASE_PATH + "/" + bookingId + "/move";
        HttpResponse<String> response = send("POST", url, body.encode());
        if (response.statusCode() != 200) {
            throw httpError("move", url, response);
        }
    }

    /**
     * The calendar's IANA timezone — the zone its slot wall-clock times live
     * in, and therefore the zone the cancel future-vs-past decision must be
     * evaluated in. Empty when the calendar is gone (404) or carries no usable
     * timezone; transport and 5xx errors throw like every other call, so the
     * surrounding job retries instead of silently judging slots in the wrong
     * zone.
     */
    public Optional<ZoneId> getCalendarTimezone(UUID calendarId) {
        String url = base() + CALENDARS_PATH + "/" + calendarId;
        HttpResponse<String> response = send("GET", url, null);
        if (response.statusCode() == 404) {
            return Optional.empty();
        }
        if (response.statusCode() != 200) {
            throw httpError("getCalendarTimezone", url, response);
        }
        return parseTimezone(response.body(), url);
    }

    /**
     * Lists slots with remaining capacity in {@code [startDate, endDate]} — drives
     * the ensure ETD auto-pick. Slots are unsorted by contract; the executor sorts
     * and windows them. Ported from ECM's {@code listAvailableSlots}.
     */
    public List<AvailableSlot> listAvailableSlots(UUID calendarId, LocalDate startDate, LocalDate endDate) {
        String url = base() + SLOTS_PATH
                + "?calendarId=" + calendarId
                + "&startDate=" + startDate
                + "&endDate=" + endDate
                + "&available=true";
        HttpResponse<String> response = send("GET", url, null);
        if (response.statusCode() != 200) {
            throw httpError("listAvailableSlots", url, response);
        }
        return parseAvailableSlots(response.body(), url);
    }

    // -------------------------------------------------------------- helpers

    private String base() {
        return baseUrl.orElseThrow(() -> new IllegalStateException(
                "miot.integrations.calendar-sync.miot-calendar.base-url is not configured"));
    }

    /**
     * The single point every call leaves through — and therefore the one place
     * that records the exchange for the job console (see {@link JobHttpTrace}).
     * Recording is a no-op outside a job's attempt window, so callers that are
     * not a job pay nothing.
     */
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
        long startedAt = System.nanoTime();
        try {
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JobHttpTrace.record(method, url, response.statusCode(), elapsedMs(startedAt), body, response.body(), null);
            return response;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            String message = "miot-calendar " + method + " " + url + " interrupted: " + e.getMessage();
            JobHttpTrace.record(method, url, null, elapsedMs(startedAt), body, null, message);
            throw new CalendarBookingsHttpException(-1, message);
        } catch (java.io.IOException e) {
            String message = "miot-calendar " + method + " " + url + " io error: " + e.getMessage();
            JobHttpTrace.record(method, url, null, elapsedMs(startedAt), body, null, message);
            throw new CalendarBookingsHttpException(-1, message);
        }
    }

    private static long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private static JsonObject slotJson(LocalDate date, int hour, int minutes) {
        return new JsonObject()
                .put("date", date.toString())
                .put("hour", hour)
                .put("minutes", minutes);
    }

    private static UUID parseBookingId(String body, String url) {
        if (body == null || body.isBlank()) {
            throw new CalendarBookingsHttpException(200, "miot-calendar create response empty from " + url);
        }
        try {
            String id = new JsonObject(body).getString("id");
            if (id == null || id.isBlank()) {
                throw new CalendarBookingsHttpException(200,
                        "miot-calendar create response missing 'id' from " + url);
            }
            return UUID.fromString(id);
        } catch (RuntimeException e) {
            throw new CalendarBookingsHttpException(200,
                    "miot-calendar create response unparseable from " + url + ": " + e.getMessage());
        }
    }

    private static List<AvailableSlot> parseAvailableSlots(String body, String url) {
        JsonArray data = parseDataArray(body, url);
        if (data == null) {
            return List.of();
        }
        List<AvailableSlot> out = new ArrayList<>(data.size());
        for (int i = 0; i < data.size(); i++) {
            AvailableSlot slot = toAvailableSlot(data.getJsonObject(i));
            if (slot != null) {
                out.add(slot);
            }
        }
        return out;
    }

    private static AvailableSlot toAvailableSlot(JsonObject slot) {
        if (slot == null) {
            return null;
        }
        String date = slot.getString("slotDate");
        Integer hour = slot.getInteger("slotHour");
        Integer minutes = slot.getInteger("slotMinutes");
        Integer avail = slot.getInteger("availableCapacity");
        if (date == null || hour == null || minutes == null || avail == null) {
            return null;
        }
        return new AvailableSlot(LocalDate.parse(date), hour, minutes, avail);
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

    private static Optional<ZoneId> parseTimezone(String body, String url) {
        if (body == null || body.isBlank()) {
            return Optional.empty();
        }
        String timezone;
        try {
            timezone = new JsonObject(body).getString("timezone");
        } catch (RuntimeException e) {
            throw new CalendarBookingsHttpException(200,
                    "miot-calendar calendar response unparseable from " + url + ": " + e.getMessage());
        }
        if (timezone == null || timezone.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(ZoneId.of(timezone));
        } catch (DateTimeException e) {
            // An unknown zone id must not fail the cancel — but a silent empty
            // would reintroduce the wrong-zone bug invisibly, so say why.
            LOG.warnf("miot-calendar calendar at %s has unparseable timezone '%s': %s",
                    url, timezone, e.getMessage());
            return Optional.empty();
        }
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

    /** A slot with remaining capacity, as returned by {@link #listAvailableSlots}. */
    public record AvailableSlot(LocalDate date, int hour, int minutes, int availableCapacity) {
    }
}
