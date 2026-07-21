package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.ModulithJobWorker;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Park hook for the booking REJECTED stamp: when an external-push job type
 * (config list, default {@code alerce_assignment}) parks as FAILED inside a
 * chain, enqueue a standalone {@code calendar_reject} job carrying the booking
 * coordinates — resolved from the chain's {@code calendar_sync} (seq 0)
 * sibling, whose payload is the only place that knows resourceId/calendarId.
 *
 * <p>Only push legs stamp: not seq 0 itself (a parked {@code calendar_sync}
 * means the booking was never patched — nothing to un-acknowledge) and not
 * {@code calendar_confirm} (the push was <i>accepted</i>; a parked confirm
 * means the calendar API is down, not that the data was rejected).
 *
 * <p>Never throws — a stamping problem must not disturb the report path that
 * fired the event.
 */
@ApplicationScoped
public class CalendarRejectOnPark {

    private static final Logger LOG = Logger.getLogger(CalendarRejectOnPark.class);
    private static final int SIBLING_LOOKUP_LIMIT = 10;

    private final List<String> rejectStampJobTypes;
    private final AsyncJobRepository repository;
    private final AsyncJobService jobService;
    private final ModulithJobWorker worker;

    @Inject
    CalendarRejectOnPark(
            @ConfigProperty(name = "miot.integrations.jobs.reject-stamp.job-types",
                    defaultValue = "alerce_assignment") List<String> rejectStampJobTypes,
            AsyncJobRepository repository,
            AsyncJobService jobService,
            ModulithJobWorker worker) {
        this.rejectStampJobTypes = rejectStampJobTypes;
        this.repository = repository;
        this.jobService = jobService;
        this.worker = worker;
    }

    void onParked(@Observes JobParkedEvent event) {
        AsyncJob parked = event.job();
        try {
            if (!rejectStampJobTypes.contains(parked.jobType()) || parked.chainKey() == null) {
                return;
            }
            Map<String, Object> coordinates = findSyncLegPayload(parked);
            if (coordinates == null) {
                LOG.warnf("Parked %s job %s has chain %s but no calendar_sync sibling — cannot stamp REJECTED",
                        parked.jobType(), parked.id(), parked.chainKey());
                return;
            }
            String resourceId = str(coordinates.get(CalendarSyncFeature.PAYLOAD_RESOURCE_ID));
            if (resourceId == null) {
                LOG.warnf("calendar_sync sibling of parked job %s carries no resourceId — cannot stamp REJECTED",
                        parked.id());
                return;
            }
            enqueueReject(parked, coordinates, resourceId);
        } catch (Exception e) {
            LOG.errorf(e, "REJECTED stamp hook failed for parked job %s (%s) — booking not flagged",
                    parked.id(), parked.jobType());
        }
    }

    /** The chain's earliest calendar_sync leg carries the booking coordinates. */
    private Map<String, Object> findSyncLegPayload(AsyncJob parked) {
        Optional<AsyncJob> syncLeg = repository
                .list(parked.tenantCode(), null, null, CalendarSyncFeature.JOB_TYPE,
                        parked.chainKey(), SIBLING_LOOKUP_LIMIT)
                .stream()
                .min(Comparator.comparingInt(AsyncJob::chainSequence));
        return syncLeg.map(AsyncJob::payload).orElse(null);
    }

    private void enqueueReject(AsyncJob parked, Map<String, Object> coordinates, String resourceId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(CalendarRejectFeature.PAYLOAD_RESOURCE_ID, resourceId);
        putIfPresent(payload, CalendarRejectFeature.PAYLOAD_CALENDAR_ID,
                str(coordinates.get(CalendarSyncFeature.PAYLOAD_CALENDAR_ID)));
        putIfPresent(payload, CalendarRejectFeature.PAYLOAD_SERVICE_CODE,
                str(coordinates.get(CalendarSyncFeature.PAYLOAD_SERVICE_CODE)));
        putIfPresent(payload, CalendarRejectFeature.PAYLOAD_DETAIL, truncatedError(parked));

        // Standalone (no chainKey) on purpose: a chained successor would be
        // blocked by the FAILED predecessor it is meant to report. The dedupe
        // key includes the parked attempt count so a re-park after a failed
        // manual retry stamps again.
        AsyncJobSpec spec = new AsyncJobSpec(
                CalendarRejectFeature.JOB_TYPE,
                ModulithJobHandler.EXECUTOR,
                parked.correlationKey(),
                null, null,
                "reject:" + parked.id() + ":" + parked.attempts(),
                payload,
                null);
        worker.onEnqueued(jobService.enqueue(parked.tenantCode(),
                new EnqueueJobsRequest(parked.sourceInstance(), "listener", List.of(spec))));
        LOG.infof("Parked %s job %s → enqueued calendar_reject for booking resource %s",
                parked.jobType(), parked.id(), resourceId);
    }

    private static String truncatedError(AsyncJob parked) {
        String error = parked.lastError();
        if (error == null || error.isBlank()) {
            return null;
        }
        return error.length() <= CalendarRejectFeature.DETAIL_MAX_LENGTH
                ? error
                : error.substring(0, CalendarRejectFeature.DETAIL_MAX_LENGTH);
    }

    private static void putIfPresent(Map<String, Object> payload, String key, String value) {
        if (value != null) {
            payload.put(key, value);
        }
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value);
        return s.isBlank() ? null : s;
    }
}
