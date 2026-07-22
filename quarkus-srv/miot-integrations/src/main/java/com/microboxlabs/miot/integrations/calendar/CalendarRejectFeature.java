package com.microboxlabs.miot.integrations.calendar;

/**
 * Constants for the modulith-executed {@code calendar_reject} job: stamps
 * {@code syncStatus=REJECTED} on a booking whose external push parked as
 * FAILED, carrying the failure detail so planners see <i>why</i> right on the
 * calendar.
 *
 * <p>Deliberately a <b>standalone</b> job, not a chain leg: a chained
 * successor of the FAILED push would be blocked by the very predecessor whose
 * failure it reports (the chain gate only passes SUCCEEDED/CANCELLED). The
 * park hook ({@code CalendarRejectOnPark}) enqueues it outside the chain, with
 * a dedupe key derived from the parked job's id and attempt count so a re-park
 * after a failed manual retry stamps again while a single park never
 * double-fires.
 *
 * <p>Recovery stays symmetric with {@link CalendarConfirmFeature}: a later
 * successful manual retry of the push unblocks the still-pending
 * {@code calendar_confirm} leg, which overwrites the booking to CONFIRMED —
 * {@code syncStatus} has no forward-only rule by design.
 */
public final class CalendarRejectFeature {

    private CalendarRejectFeature() {
    }

    public static final String JOB_TYPE = "calendar_reject";

    /** Self-contained payload, resolved by the park hook from the chain's seq-0 sibling. */
    public static final String PAYLOAD_SERVICE_CODE = "serviceCode";
    public static final String PAYLOAD_CALENDAR_ID = "calendarId";
    public static final String PAYLOAD_RESOURCE_ID = "resourceId";
    /** The parked job's lastError, pre-truncated to the booking sync_detail budget. */
    public static final String PAYLOAD_DETAIL = "detail";

    /** Value written to the booking's {@code syncStatus}. */
    public static final String SYNC_STATUS_REJECTED = "REJECTED";

    /** miot-calendar's {@code sync_detail} column budget (VARCHAR(500)). */
    public static final int DETAIL_MAX_LENGTH = 500;
}
