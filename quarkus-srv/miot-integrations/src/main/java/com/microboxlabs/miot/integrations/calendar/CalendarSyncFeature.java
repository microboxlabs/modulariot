package com.microboxlabs.miot.integrations.calendar;

/**
 * Constants for the modulith-executed {@code calendar_sync} job.
 *
 * <p>This is the modulith counterpart of ECM's
 * {@code cl.mintral.features.calendar.sync.CalendarSyncFeature}: ECM enqueues a
 * self-contained booking-lifecycle snapshot on the async-job ledger, stamped with
 * the {@code modulith} executor lane ({@code ModulithJobHandler.EXECUTOR}), and
 * {@link CalendarSyncExecutor} claims and runs it here instead of on ECM. The
 * payload field names and op values below MUST stay in lockstep with the ECM
 * enqueuer (the payload is the wire contract).
 */
public final class CalendarSyncFeature {

    private CalendarSyncFeature() {
    }

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
