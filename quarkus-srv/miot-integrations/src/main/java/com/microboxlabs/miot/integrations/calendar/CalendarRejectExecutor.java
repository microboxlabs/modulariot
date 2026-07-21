package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * {@link ModulithJobHandler} for {@code calendar_reject}: stamps
 * {@code syncStatus=REJECTED} plus the failure detail on the booking after its
 * external push parked as FAILED — see {@link CalendarRejectFeature} for why
 * this runs outside the chain.
 *
 * <p>Outcome policy mirrors {@link CalendarConfirmExecutor}: 404 (booking gone)
 * is a benign SKIP; transport / 5xx / network errors are thrown so the ledger
 * retries with backoff. The sync-status patch has no regression rules on the
 * miot-calendar side, so there is no 409 case.
 */
@ApplicationScoped
public class CalendarRejectExecutor implements ModulithJobHandler {

    private static final Logger LOG = Logger.getLogger(CalendarRejectExecutor.class);
    private static final String DEFAULT_DETAIL = "The external push failed";

    private final CalendarBookingsClient client;

    @Inject
    CalendarRejectExecutor(CalendarBookingsClient client) {
        this.client = client;
    }

    @Override
    public String jobType() {
        return CalendarRejectFeature.JOB_TYPE;
    }

    /** Not ready until the miot-calendar base URL is configured. */
    @Override
    public boolean isReady() {
        return client.isConfigured();
    }

    @Override
    public JobOutcome handle(Map<String, Object> payload) {
        String resourceId = str(payload, CalendarRejectFeature.PAYLOAD_RESOURCE_ID);
        String calendarIdRaw = str(payload, CalendarRejectFeature.PAYLOAD_CALENDAR_ID);
        String serviceCode = str(payload, CalendarRejectFeature.PAYLOAD_SERVICE_CODE);
        String detail = str(payload, CalendarRejectFeature.PAYLOAD_DETAIL);
        if (resourceId == null) {
            throw new IllegalArgumentException("calendar_reject payload missing resourceId");
        }
        UUID calendarId = calendarIdRaw == null ? null : UUID.fromString(calendarIdRaw);
        String syncDetail = truncate(detail == null ? DEFAULT_DETAIL : detail);

        try {
            client.patchByResource(resourceId, calendarId, null, null,
                    CalendarRejectFeature.SYNC_STATUS_REJECTED, syncDetail);
            return JobOutcome.succeeded("Booking sync REJECTED for " + resourceId);
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() == 404) {
                // The booking was unplanned/cancelled meanwhile — nothing left
                // to flag.
                LOG.infof("calendar_reject: no booking for %s (service %s) — skipping", resourceId, serviceCode);
                return JobOutcome.skipped("No booking to flag for " + resourceId);
            }
            throw e;
        }
    }

    private static String truncate(String detail) {
        return detail.length() <= CalendarRejectFeature.DETAIL_MAX_LENGTH
                ? detail
                : detail.substring(0, CalendarRejectFeature.DETAIL_MAX_LENGTH);
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
