package com.microboxlabs.miot.integrations.calendar;

/**
 * Constants for the modulith-executed {@code calendar_confirm} job — the third
 * leg of ECM's assign chain ({@code calendar_sync} seq 0 → {@code
 * alerce_assignment} seq 1 → this, seq 2). Payload field names MUST stay in
 * lockstep with ECM's {@code CalendarConfirmFeature} (the payload is the wire
 * contract).
 *
 * <p>The ledger's chain gate is the whole design: this job becomes claimable
 * only once the {@code alerce_assignment} leg reports SUCCEEDED — which, since
 * the executor fails jobs on a non-OK Alerce body, means Alerce genuinely
 * accepted the tuple. A rejected/parked push keeps this leg blocked and the
 * booking stays {@code syncStatus=PENDING} ("planned but unconfirmed"); a
 * later successful manual retry unblocks it with no extra machinery.
 */
public final class CalendarConfirmFeature {

    private CalendarConfirmFeature() {
    }

    public static final String JOB_TYPE = "calendar_confirm";

    /** Self-contained payload (mirrors ECM's enqueuer). */
    public static final String PAYLOAD_SERVICE_CODE = "serviceCode";
    public static final String PAYLOAD_CALENDAR_ID = "calendarId";
    public static final String PAYLOAD_RESOURCE_ID = "resourceId";

    /** Value written to the booking's {@code syncStatus} on confirmation. */
    public static final String SYNC_STATUS_CONFIRMED = "CONFIRMED";
}
