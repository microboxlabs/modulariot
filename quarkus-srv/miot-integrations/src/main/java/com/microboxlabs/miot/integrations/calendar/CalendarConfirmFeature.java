package com.microboxlabs.miot.integrations.calendar;

/**
 * Constants for the modulith-executed {@code calendar_confirm} job — the
 * closing leg of a producer's calendar chain, gated behind the
 * {@code integration_event_dispatch} push that precedes it. Payload field names
 * MUST stay in lockstep with the producer's enqueuer (the payload is the wire
 * contract).
 *
 * <p>The ledger's chain gate is the whole design: this job becomes claimable
 * only once the dispatch leg reports SUCCEEDED — which, since the dispatcher
 * fails jobs whose response body misses the binding's success condition, means
 * the partner genuinely accepted the push. A rejected/parked dispatch keeps
 * this leg blocked and the booking stays {@code syncStatus=PENDING} ("planned
 * but unconfirmed"); a later successful manual retry unblocks it with no extra
 * machinery.
 */
public final class CalendarConfirmFeature {

    private CalendarConfirmFeature() {
    }

    public static final String JOB_TYPE = "calendar_confirm";

    /** Self-contained payload (mirrors ECM's enqueuer). */
    public static final String PAYLOAD_SERVICE_CODE = "serviceCode";
    public static final String PAYLOAD_CALENDAR_ID = "calendarId";
    public static final String PAYLOAD_RESOURCE_ID = "resourceId";
    /**
     * Optional human-readable text written to the booking's {@code syncDetail}
     * on confirmation. The enqueuer supplies it because only the enqueuer knows
     * what was confirmed — an assignment tuple, an unassignment's stand-in
     * values — and the partner's name is operator vocabulary that does not
     * belong in this executor. Absent: a generic fallback is written.
     */
    public static final String PAYLOAD_SYNC_DETAIL = "syncDetail";

    /** Value written to the booking's {@code syncStatus} on confirmation. */
    public static final String SYNC_STATUS_CONFIRMED = "CONFIRMED";

    /** {@code syncDetail} fallback when the payload names none. */
    public static final String DEFAULT_SYNC_DETAIL = "Partner accepted the sync";
}
