package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.List;

/** What the SLA timer reads and the marks it leaves, so a case's SLA expires once per level. */
public interface SlaStore {

    /**
     * An open ACTIVE case whose current level ({@link EngineCase#level()}) has an SLA that ran out with no
     * treatment attending it, and no SLA expiry marked yet at that level.
     *
     * @param levelSince when the case reached the level
     */
    record Due(String tenantCode, EngineCase engineCase, Instant levelSince, int slaMinutes) {
    }

    /** Every organization's due cases opened after {@code openedAfter}, longest at their level first. */
    List<Due> due(Instant openedAfter, Instant now, int limit);

    /** Marks the level's SLA expired; false when it already was. */
    boolean markExpired(String tenantCode, long caseId, int level, int slaMinutes, Instant at);
}
