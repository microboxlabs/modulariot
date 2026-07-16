package com.microboxlabs.miot.integrations.calendar;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Translates a self-contained {@code calendar_sync} payload into miot-calendar
 * calls. Ported verbatim from ECM's {@code CalendarSyncJobExecutor} — the moved
 * runtime is the only change.
 *
 * <p>Outcome policy: 404 (no booking) and 409 (status regression — a newer
 * status already applied by an out-of-order sibling) are benign SKIPs; transport
 * / 5xx / network ({@code -1}) errors are thrown so the worker reports FAILED and
 * the ledger retries with backoff. miot-calendar only moves statuses forward, so
 * unordered jobs converge on the max status.
 */
@ApplicationScoped
public class CalendarSyncExecutor {

    private static final Logger LOG = Logger.getLogger(CalendarSyncExecutor.class);

    static final String OUTCOME_SUCCEEDED = "SUCCEEDED";
    static final String OUTCOME_SKIPPED = "SKIPPED";

    private final CalendarBookingsClient client;
    private final Clock clock;

    @Inject
    CalendarSyncExecutor(CalendarBookingsClient client) {
        this(client, Clock.systemDefaultZone());
    }

    CalendarSyncExecutor(CalendarBookingsClient client, Clock clock) {
        this.client = client;
        this.clock = clock;
    }

    /** Worker outcome: SUCCEEDED / SKIPPED. Retryable failures are thrown, not returned. */
    public record Result(String outcome, String detail) {

        static Result succeeded(String detail) {
            return new Result(OUTCOME_SUCCEEDED, detail);
        }

        static Result skipped(String detail) {
            return new Result(OUTCOME_SKIPPED, detail);
        }
    }

    public Result execute(Map<String, Object> payload) {
        String op = str(payload, CalendarSyncFeature.PAYLOAD_OP);
        String resourceId = str(payload, CalendarSyncFeature.PAYLOAD_RESOURCE_ID);
        String calendarIdRaw = str(payload, CalendarSyncFeature.PAYLOAD_CALENDAR_ID);
        if (op == null || resourceId == null) {
            throw new IllegalArgumentException("calendar_sync payload missing op/resourceId");
        }
        UUID calendarId = calendarIdRaw == null ? null : UUID.fromString(calendarIdRaw);

        if (CalendarSyncFeature.OP_PATCH.equals(op)) {
            return executePatch(payload, resourceId, calendarId);
        }
        if (CalendarSyncFeature.OP_CANCEL.equals(op)) {
            return executeCancel(resourceId, calendarId);
        }
        throw new IllegalArgumentException("calendar_sync unknown op: " + op);
    }

    private Result executePatch(Map<String, Object> payload, String resourceId, UUID calendarId) {
        String targetStatus = str(payload, CalendarSyncFeature.PAYLOAD_TARGET_STATUS);
        Map<String, Object> resourceData = asMap(payload.get(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA));
        try {
            client.patchByResource(resourceId, calendarId, targetStatus, resourceData);
            return Result.succeeded("Booking patched to " + targetStatus + " for " + resourceId);
        } catch (CalendarBookingsHttpException e) {
            Result benign = benignSkip(e, resourceId, targetStatus);
            if (benign != null) {
                return benign;
            }
            throw e;
        }
    }

    /**
     * Cancel decided from the freshest slot: future slot → DELETE (release
     * capacity); past slot → PATCH CANCELLED (keep history). No matching
     * booking → SKIPPED.
     */
    private Result executeCancel(String resourceId, UUID calendarId) {
        List<CalendarBookingsClient.BookingView> bookings = client.listByResource(resourceId, calendarId);
        if (bookings.isEmpty()) {
            return Result.skipped("No booking to cancel for " + resourceId);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        int deleted = 0;
        boolean pastRemains = false;
        for (var booking : bookings) {
            if (isFutureSlot(booking, now)) {
                deleted += tryDelete(booking, resourceId);
            } else {
                pastRemains = true;
            }
        }

        if (pastRemains) {
            try {
                client.patchByResource(resourceId, calendarId, CalendarSyncFeature.STATUS_CANCELLED, null);
            } catch (CalendarBookingsHttpException e) {
                if (benignSkip(e, resourceId, CalendarSyncFeature.STATUS_CANCELLED) == null) {
                    throw e;
                }
            }
        }
        return Result.succeeded(String.format(
                "Cancel applied for %s (deleted=%d, pastPatched=%b)", resourceId, deleted, pastRemains));
    }

    private int tryDelete(CalendarBookingsClient.BookingView booking, String resourceId) {
        try {
            client.cancel(booking.id());
            return 1;
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() != 404) {
                throw e;
            }
            // Already gone (raced with an unplan) — nothing to release.
            LOG.infof("Booking %s already gone while cancelling %s", booking.id(), resourceId);
            return 0;
        }
    }

    /** 404/409 are benign for status pushes; anything else is not ours to absorb. */
    private static Result benignSkip(CalendarBookingsHttpException e, String resourceId, String targetStatus) {
        if (e.getStatus() == 404) {
            return Result.skipped("No booking for " + resourceId + " (status " + targetStatus + ")");
        }
        if (e.getStatus() == 409) {
            return Result.skipped("Status regression rejected for " + resourceId + " -> " + targetStatus
                    + " (a newer status already applied)");
        }
        return null;
    }

    private static boolean isFutureSlot(CalendarBookingsClient.BookingView booking, LocalDateTime now) {
        LocalDate date = booking.slotDate();
        if (date.isAfter(now.toLocalDate())) {
            return true;
        }
        if (date.isBefore(now.toLocalDate())) {
            return false;
        }
        return LocalTime.of(booking.slotHour(), booking.slotMinutes()).isAfter(now.toLocalTime());
    }

    private static String str(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
    }
}
