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

    /**
     * Extension point: before a booking write, an operator-authored fetch binding on this
     * event may resolve extra {@code resource.data} values from a configured connection
     * (e.g. workflow identifiers → accredited-resource ids). Scoped by calendar; no binding
     * means no enrichment, which is the pre-binding behaviour.
     */
    public static final String EVENT_RESOURCE_ENRICHMENT = "calendar.resource_enrichment";
    public static final String SCOPE_CALENDAR = "calendar";

    /**
     * Dispatch-shaped sibling of {@link #EVENT_RESOURCE_ENRICHMENT}: when a service's
     * resource assignment is (re)made, an {@code integration_event_dispatch} job addressed
     * to this event pushes it to whatever system the operator bound — connection, field
     * mapping, stand-in defaults and response verdicts are all binding rows. The producer
     * owns the context vocabulary; this module only registers which roots templates may
     * read.
     */
    public static final String EVENT_RESOURCE_ASSIGNMENT = "calendar.resource_assignment";

    /**
     * The clean counterpart of {@link #EVENT_RESOURCE_ASSIGNMENT}: dispatched when a
     * service leaves its assignment (unassign, unplan) to clear the partner's resource
     * view. Its context is deliberately empty, so the binding's field defaults render
     * the whole body — with explicit-null defaults saying "remove this slot" out loud
     * (a merge-on-missing partner keeps a stored value for an omitted key) and literal
     * defaults carrying whatever stand-in the partner expects (e.g. a placeholder
     * provider). Splitting the event is what lets the assignment binding drop its
     * stand-ins without this flow losing them.
     */
    public static final String EVENT_RESOURCE_RELEASE = "calendar.resource_release";

    /**
     * Context roots for {@link #EVENT_RESOURCE_ASSIGNMENT} and
     * {@link #EVENT_RESOURCE_RELEASE} bindings: {@code service} (nested scalars —
     * {@code service.code}, {@code service.kind}) and the same {@code resourceData}
     * identity map every calendar push carries. Scalars are nested because a bare
     * root reads as a whole object to the validator. The release event shares the
     * vocabulary — its context is simply empty at dispatch time.
     */
    public static final java.util.Set<String> ASSIGNMENT_TEMPLATE_ROOTS =
            java.util.Set.of("service", "resourceData");

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
     * Optional TMS-confirmation status on an {@link #OP_PATCH}
     * (miot-calendar {@code syncStatus} — orthogonal to the monotonic
     * lifecycle {@code status}). The ECM assign chain stamps {@code PENDING}
     * here to open the confirmation window that the {@code calendar_confirm}
     * leg later closes.
     */
    public static final String PAYLOAD_SYNC_STATUS = "syncStatus";

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

    /**
     * Roots an enrichment binding's request templates may read — the calendar_sync
     * payload itself. What the authoring API validates against, so an operator can
     * write {@code {{resourceData.mintral_driver1Rut}}} and cannot write a root the
     * job will never carry.
     */
    public static final java.util.Set<String> ENRICHMENT_TEMPLATE_ROOTS = java.util.Set.of(
            PAYLOAD_OP, PAYLOAD_SERVICE_CODE, PAYLOAD_CALENDAR_ID, PAYLOAD_RESOURCE_ID,
            PAYLOAD_RESOURCE_TYPE, PAYLOAD_TARGET_STATUS, PAYLOAD_RESOURCE_DATA, PAYLOAD_ETD,
            PAYLOAD_SLOT_DATE, PAYLOAD_SLOT_HOUR, PAYLOAD_SLOT_MINUTES, PAYLOAD_SYNC_STATUS);

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

    /** Terminal booking status pushed when the trip ends normally. */
    public static final String STATUS_FINISHED = "FINISHED";

    /**
     * {@link #PAYLOAD_RESOURCE_DATA} key carrying the workflow's ISO ETD on
     * every push — the producer writes it alongside the {@code mintral_*}
     * identity, so a patch holds enough to place a booking that never existed.
     */
    public static final String DATA_EXPECTED_DEPARTURE_DATE = "expectedDepartureDate";

    /** After these a booking's lifecycle is over — a missing one must stay missing. */
    public static boolean isTerminalStatus(String status) {
        return STATUS_FINISHED.equals(status) || STATUS_CANCELLED.equals(status);
    }
}
