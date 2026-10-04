package com.microboxlabs.miot.symptoms.catalog.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * The rules of one symptom version. Conditions are CEL expressions:
 * {@code activation} over the source's root object, each level's {@code when}
 * over {@code medida} and {@code sostenido_s}, and the lifecycle over a
 * {@code caso} object.
 *
 * @param source     key of the {@link DataSource} the rules read
 * @param activation which situations are candidates
 * @param measure    the number that sets the level
 * @param levels     the four ICU levels, lowest first
 * @param lifecycle  when a case opens and closes
 * @param recurrence optional: raise later cases of the same plate
 * @param family     the {@code symptom_families} value this version files the symptom under; null keeps the
 *                   symptom's
 * @param state      the state publishing this version sets; null keeps the symptom's
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SymptomSpec(
        String source,
        String activation,
        Measure measure,
        List<Level> levels,
        Lifecycle lifecycle,
        Recurrence recurrence,
        String family,
        SymptomState state) {

    /** A spec that leaves the family and the state as the symptom has them. */
    public SymptomSpec(String source, String activation, Measure measure, List<Level> levels, Lifecycle lifecycle,
            Recurrence recurrence) {
        this(source, activation, measure, levels, lifecycle, recurrence, null, null);
    }

    public SymptomSpec withState(SymptomState next) {
        return new SymptomSpec(source, activation, measure, levels, lifecycle, recurrence, family, next);
    }

    /** This spec with the family and state filled in where it leaves them to the symptom. */
    public SymptomSpec withDefaults(String defaultFamily, SymptomState defaultState) {
        return new SymptomSpec(source, activation, measure, levels, lifecycle, recurrence,
                family == null ? defaultFamily : family, state == null ? defaultState : state);
    }

    /** True when nothing is set, as when a request body is {@code {}}. */
    @JsonIgnore
    public boolean isEmpty() {
        return source == null && activation == null && measure == null && levels == null && lifecycle == null
                && recurrence == null && family == null && state == null;
    }

    /** @param expression CEL over the source object; null for symptoms with a fixed level */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Measure(String expression, String label, String unit) {
    }

    /**
     * @param icu     1 to 4
     * @param applies false when the symptom never produces this level
     * @param when    CEL over {@code medida} and {@code sostenido_s}
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Level(int icu, boolean applies, String when, Response response) {
    }

    /**
     * What happens at a level.
     *
     * @param operator    a person must handle the case
     * @param slaMinutes  time to handle it, when {@code operator}
     * @param steps       the operator's ordered steps
     * @param notices     automatic notices
         * @param evidence    what must be recorded to close it
     * @param ignorable   the operator may ignore the condition
     * @param escalateTo  who is told when the SLA runs out (for example "Jefe de torre"), or null
     * @param consequence the case counts in the consequence management of whoever caused it
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(
            boolean operator,
            Integer slaMinutes,
            List<Step> steps,
            List<Notice> notices,
            List<String> evidence,
            boolean ignorable,
            String escalateTo,
            boolean consequence) {

        /** A response without escalation, outside consequence management. */
        public Response(boolean operator, Integer slaMinutes, List<Step> steps, List<Notice> notices,
                List<String> evidence, boolean ignorable) {
            this(operator, slaMinutes, steps, notices, evidence, ignorable, null, false);
        }
    }

    /**
     * One step of the operator's ladder.
     *
     * @param role          who to contact, as the operator reads it (for example "Conductor"); free text,
     *                      like a contact's role
     * @param channel       call, whatsapp, teams, email
     * @param budgetMinutes time for this step within the SLA
     * @param script        what to say; may use case fields as {@code {{ }}} variables
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step(String role, String channel, Integer budgetMinutes, String script) {
    }

    /**
     * An automatic notice, sent through an Integrations connection.
     *
     * @param when         on open, on level up, on SLA expiry, on close
     * @param channel      teams, whatsapp, email, app, webhook
     * @param connectionId the connection that sends it
     * @param templateId   the connection's message template
     * @param recipient    who receives it
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Notice(String when, String channel, String connectionId, String templateId, String recipient) {
    }

    /**
     * @param open      CEL over {@code caso}
     * @param close     CEL over {@code caso}
     * @param levelDown the level follows the measure down while the case is open; otherwise it never goes down
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Lifecycle(String open, String close, boolean levelDown) {

        /** A lifecycle whose level never goes down. */
        public Lifecycle(String open, String close) {
            this(open, close, false);
        }
    }

    /**
     * Raise the level by {@code raiseLevels} when the same {@code entity} repeats {@code count} times in
     * {@code days}.
     *
     * @param entity what repeats: {@code patente} (the vehicle) or {@code conductor}; null means the vehicle
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Recurrence(boolean enabled, int count, int days, int raiseLevels, String entity) {

        public static final String VEHICLE = "patente";
        public static final String DRIVER = "conductor";

        /** A recurrence counted per vehicle. */
        public Recurrence(boolean enabled, int count, int days, int raiseLevels) {
            this(enabled, count, days, raiseLevels, VEHICLE);
        }
    }
}
