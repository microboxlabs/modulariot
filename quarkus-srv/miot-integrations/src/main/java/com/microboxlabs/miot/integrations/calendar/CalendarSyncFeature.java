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
    public static final String PAYLOAD_RESOURCE_TYPE = "resourceType";
    public static final String PAYLOAD_TARGET_STATUS = "targetStatus";
    public static final String PAYLOAD_RESOURCE_DATA = "resourceData";
    /**
     * Top-level {@code resource.data} keys an {@link #OP_UNASSIGN} clears. ECM
     * names them because the payload vocabulary is its own — miot-calendar and
     * this worker only know a booking <i>has</i> data, not what "assigned
     * driver" is called in it.
     */
    public static final String PAYLOAD_CLEAR_DATA_KEYS = "clearDataKeys";

    /**
     * Slot source for {@link #OP_ENSURE} (Phase 2). Either an explicit slot
     * ({@link #PAYLOAD_SLOT_DATE}/{@link #PAYLOAD_SLOT_HOUR}/{@link #PAYLOAD_SLOT_MINUTES},
     * a planner drag) or an {@link #PAYLOAD_ETD} for next-available auto-pick at
     * <b>execute</b> time — a retry re-picks against fresh availability, so a
     * transient no-slot self-heals when capacity frees.
     */
    public static final String PAYLOAD_SLOT_DATE = "slotDate";
    public static final String PAYLOAD_SLOT_HOUR = "slotHour";
    public static final String PAYLOAD_SLOT_MINUTES = "slotMinutes";
    public static final String PAYLOAD_ETD = "etd";

    /** Status-only push (legacy CALSYNC): PATCH, 404 skips. */
    public static final String OP_PATCH = "patch";
    /**
     * Upsert (Phase 2): create-if-absent at the slot, re-slot an existing
     * booking when an explicit slot differs, then set the stage status. Makes
     * the calendar a retryable projection of the kanban stage.
     */
    public static final String OP_ENSURE = "ensure";
    public static final String OP_CANCEL = "cancel";
    /**
     * Unassign: reset the booking to {@code PLANNED} and clear the assignment
     * keys, keeping the slot. The coordinator's workflow is not monotonic — a
     * service can go back from {@code presentDriver} to {@code assignDriver} —
     * and miot-calendar rejects that as a status regression on a plain
     * {@link #OP_PATCH}, so the revert needs its own operation.
     */
    public static final String OP_UNASSIGN = "unassign";

    /** Resource type sent when {@link #OP_ENSURE} creates a booking. */
    public static final String DEFAULT_RESOURCE_TYPE = "service";

    /** Terminal booking status pushed for a past-slot cancel (keep history). */
    public static final String STATUS_CANCELLED = "CANCELLED";
}
