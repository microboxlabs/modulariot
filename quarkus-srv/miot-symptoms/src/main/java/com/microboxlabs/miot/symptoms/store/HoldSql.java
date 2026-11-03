package com.microboxlabs.miot.symptoms.store;

/**
 * SQL over the "Ignorar condición" holds: an engine case's treatment with an {@code IGNORE} action, whose latest
 * such action ({@code a}) carries the duration and, in {@code details}, {@code scope} and {@code until_trip_end}.
 * The treatment store writes {@code details} as a JSON string holding the object; both shapes are read.
 * {@code h} is the ignored case's OPENED transition.
 */
final class HoldSql {

    static final String TRIP_END = "COALESCE((a.details->>'until_trip_end')::boolean, false)";
    static final String SCOPE = "COALESCE(NULLIF(UPPER(TRIM(a.details->>'scope')), ''), 'CASE')";
    static final String UNTIL = "a.performed_at + make_interval(secs => COALESCE(a.duration_seconds, 0))";

    /** The holds with their ignored case and latest IGNORE action. */
    static final String HOLDS = """
              FROM miot_symptoms.treatment t
              JOIN miot_symptoms.signal_transitions h ON h.tenant_code = t.tenant_code AND h.id = -t.symptom_id
              JOIN LATERAL (SELECT ia.performed_at, ia.performed_by, ia.duration_seconds,
                                   CASE jsonb_typeof(ia.details) WHEN 'string' THEN (ia.details #>> '{}')::jsonb
                                        ELSE ia.details END AS details
                              FROM miot_symptoms.treatment_action ia
                             WHERE ia.treatment_id = t.id AND ia.tenant_code = t.tenant_code AND ia.kind = 'IGNORE'
                             ORDER BY ia.seq DESC LIMIT 1) a ON true
             WHERE t.symptom_id < 0 AND t.type = 'IGNORE_CONDITION'
            """;

    private HoldSql() {
    }

    /** The holds that cover the case row {@code o} (its tenant_code, id, asset_id, definition_id): see scope. */
    private static String covering(String o) {
        return HOLDS + """
                   AND t.tenant_code = %1$s.tenant_code AND h.asset_id = %1$s.asset_id
                   AND (h.id = %1$s.id OR %2$s = 'ALL' OR (%2$s = 'SYMPTOM' AND h.definition_id = %1$s.definition_id))
                """.formatted(o, SCOPE);
    }

    /**
     * The hold on the case row {@code o} now, at most one, its own first: hold_id, hold_at, hold_until (null until
     * the trip ends), hold_trip_end, hold_scope, hold_by. A hold covers it until the timer records its end, including the return time for
     * the new SLA.
     */
    static String active(String o) {
        return "SELECT t.id::text AS hold_id, a.performed_at AS hold_at, CASE WHEN " + TRIP_END
                + " THEN NULL ELSE " + UNTIL + " END AS hold_until, " + TRIP_END + " AS hold_trip_end, " + SCOPE
                + " AS hold_scope, a.performed_by AS hold_by" + covering(o) + " AND t.status = 'OPEN'"
                + " ORDER BY h.id = " + o + ".id DESC, a.performed_at DESC"
                + " LIMIT 1";
    }

    /** When the latest hold that covered the case row {@code o} ended after it opened, as returned_at. */
    static String returned(String o) {
        return "SELECT max(t.closed_at) AS returned_at" + covering(o) + " AND t.status = 'CLOSED' AND t.closed_at > "
                + o + ".at";
    }
}
