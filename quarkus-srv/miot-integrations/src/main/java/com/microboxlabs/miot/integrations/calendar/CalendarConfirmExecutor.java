package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * {@link ModulithJobHandler} for {@code calendar_confirm}: stamps
 * {@code syncStatus=CONFIRMED} on the booking once its chain predecessor (the
 * {@code alerce_assignment} push) has SUCCEEDED — see
 * {@link CalendarConfirmFeature} for the chain semantics.
 *
 * <p>Outcome policy mirrors {@link CalendarSyncExecutor}: 404 (booking gone —
 * unplanned or cancelled while the push was in flight) is a benign SKIP;
 * transport / 5xx / network ({@code -1}) errors are thrown so the worker
 * reports FAILED and the ledger retries with backoff. The sync-status patch
 * has no regression rules on the miot-calendar side, so there is no 409 case.
 */
@ApplicationScoped
public class CalendarConfirmExecutor implements ModulithJobHandler {

    private static final Logger LOG = Logger.getLogger(CalendarConfirmExecutor.class);

    private final CalendarBookingsClient client;

    @Inject
    CalendarConfirmExecutor(CalendarBookingsClient client) {
        this.client = client;
    }

    @Override
    public String jobType() {
        return CalendarConfirmFeature.JOB_TYPE;
    }

    /** Not ready until the miot-calendar base URL is configured. */
    @Override
    public boolean isReady() {
        return client.isConfigured();
    }

    @Override
    public JobOutcome handle(Map<String, Object> payload) {
        String resourceId = str(payload, CalendarConfirmFeature.PAYLOAD_RESOURCE_ID);
        String calendarIdRaw = str(payload, CalendarConfirmFeature.PAYLOAD_CALENDAR_ID);
        String serviceCode = str(payload, CalendarConfirmFeature.PAYLOAD_SERVICE_CODE);
        if (resourceId == null) {
            throw new IllegalArgumentException("calendar_confirm payload missing resourceId");
        }
        java.util.UUID calendarId = calendarIdRaw == null ? null : java.util.UUID.fromString(calendarIdRaw);

        try {
            client.patchByResource(resourceId, calendarId, null, null,
                    CalendarConfirmFeature.SYNC_STATUS_CONFIRMED,
                    "Alerce accepted the assignment (code=OK)");
            return JobOutcome.succeeded("Booking sync CONFIRMED for " + resourceId);
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() == 404) {
                // The booking was unplanned/cancelled while the push was in
                // flight — nothing left to confirm.
                LOG.infof("calendar_confirm: no booking for %s (service %s) — skipping", resourceId, serviceCode);
                return JobOutcome.skipped("No booking to confirm for " + resourceId);
            }
            throw e;
        }
    }

    private static String str(Map<String, Object> payload, String key) {
        Object v = payload.get(key);
        if (v == null) {
            return null;
        }
        String s = String.valueOf(v);
        return s.isBlank() ? null : s;
    }
}
