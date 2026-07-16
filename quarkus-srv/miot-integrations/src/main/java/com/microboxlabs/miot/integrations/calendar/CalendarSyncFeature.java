package com.microboxlabs.miot.integrations.calendar;

/**
 * Constants for the modulith-executed {@code calendar_sync} job.
 *
 * <p>This is the modulith counterpart of ECM's
 * {@code cl.mintral.features.calendar.sync.CalendarSyncFeature}: ECM enqueues a
 * self-contained booking-lifecycle snapshot on the async-job ledger, and — when
 * stamped with executor {@link #EXECUTOR} — the modulith claims and runs it here
 * instead of on ECM. The payload field names and op values below MUST stay in
 * lockstep with the ECM enqueuer (the payload is the wire contract).
 */
public final class CalendarSyncFeature {

    private CalendarSyncFeature() {
    }

    /**
     * Executor lane: {@code calendar_sync} jobs stamped with this value run
     * inside the modulith (off ECM). Must match the value ECM stamps on enqueue
     * ({@code mintral.features.integrationOutbox.calendarSync.executor=modulith}).
     * ECM claims only its own {@code "ecm"} lane, so the two never collide.
     */
    public static final String EXECUTOR = "modulith";

    public static final String JOB_TYPE = "calendar_sync";

    /** Payload field names (self-contained — the worker never re-reads process vars). */
    public static final String PAYLOAD_OP = "op";
    public static final String PAYLOAD_SERVICE_CODE = "serviceCode";
    public static final String PAYLOAD_CALENDAR_ID = "calendarId";
    public static final String PAYLOAD_RESOURCE_ID = "resourceId";
    public static final String PAYLOAD_TARGET_STATUS = "targetStatus";
    public static final String PAYLOAD_RESOURCE_DATA = "resourceData";

    public static final String OP_PATCH = "patch";
    public static final String OP_CANCEL = "cancel";

    /** Terminal booking status pushed for a past-slot cancel (keep history). */
    public static final String STATUS_CANCELLED = "CANCELLED";
}
