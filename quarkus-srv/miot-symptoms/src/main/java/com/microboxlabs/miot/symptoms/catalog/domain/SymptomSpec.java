package com.microboxlabs.miot.symptoms.catalog.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Duration;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * The rules of one symptom version. Conditions are CEL expressions:
 * {@code activation} over the source's root object, each level's {@code when}
 * over {@code measure} and {@code held_s}, and the lifecycle over a
 * {@code case} object.
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

    /** A measure without an expression is no measure, whatever name it kept. */
    public SymptomSpec {
        measure = measure == null || measure.expression() == null ? null : measure;
    }

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

        /** A blank expression is no measure: levels are then measured by the time held. */
        public Measure {
            expression = expression == null || expression.isBlank() ? null : expression;
        }
    }

    /**
     * @param icu     1 to 4
     * @param applies false when the symptom never produces this level
     * @param when    CEL over {@code measure} and {@code held_s}
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Level(int icu, boolean applies, String when, Response response,
            @JsonInclude(JsonInclude.Include.NON_NULL) Ignore ignore) {

        /** A level without an ignore policy: everything allowed. */
        public Level(int icu, boolean applies, String when, Response response) {
            this(icu, applies, when, response, null);
        }
    }

    /**
     * What "Ignorar condición" allows at a level. Each field null for the default.
     *
     * @param allowed      the operator may ignore the case at this level; default true
     * @param maxDuration  the longest hold, ISO-8601 (for example {@code PT30M}); default none. With it, "until the
     *                     trip ends" is not offered
     * @param noteRequired a note is required whatever the reason; default only for "Otro"
     * @param scopes       the scopes offered ({@code CASE}, {@code SYMPTOM}, {@code ALL}); default all
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Ignore(Boolean allowed, @JsonProperty("max_duration") String maxDuration,
            @JsonProperty("note_required") Boolean noteRequired, List<String> scopes) {

        public static final List<String> VALID_SCOPES = List.of("CASE", "SYMPTOM", "ALL");

        /** The longest hold, or null for none. */
        public Duration maxDurationValue() {
            if (maxDuration == null || maxDuration.isBlank()) {
                return null;
            }
            try {
                return Duration.parse(maxDuration.trim());
            } catch (DateTimeParseException e) {
                throw new IllegalArgumentException("ignore.max_duration must be an ISO-8601 duration");
            }
        }
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
     * @param escalateTo    the role told when the SLA runs out (for example "Jefe de torre"), or null
     * @param consequence   the case counts in the consequence management of whoever caused it
     * @param escalateScope where {@code escalateTo} is looked up, one of {@link Step#SCOPES}; null in older specs
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
            boolean consequence,
            String escalateScope) {

        /** A response without escalation, outside consequence management. */
        public Response(boolean operator, Integer slaMinutes, List<Step> steps, List<Notice> notices,
                List<String> evidence, boolean ignorable) {
            this(operator, slaMinutes, steps, notices, evidence, ignorable, null, false, null);
        }

        /** A response whose escalation target has no scope. */
        public Response(boolean operator, Integer slaMinutes, List<Step> steps, List<Notice> notices,
                List<String> evidence, boolean ignorable, String escalateTo, boolean consequence) {
            this(operator, slaMinutes, steps, notices, evidence, ignorable, escalateTo, consequence, null);
        }
    }

    /**
     * One step of the operator's ladder. The person to contact is a scope plus a role of the contact book.
     *
     * @param role          the contact book role (for example "Gerente de Seguridad"); for {@code DRIVER},
     *                      "Conductor"; for {@code TRIP_CARRIER}, blank means any contact of the carrier
     * @param channel       call, whatsapp, teams, email
     * @param budgetMinutes time for this step within the SLA
     * @param script        what to say; may use case fields as {@code {{ }}} variables
     * @param scope         {@code DRIVER} (the trip's driver), {@code TRIP_CARRIER} (people of the trip's
     *                      carrier) or {@code ORG} (the organization's own people); null in older specs, read from
     *                      the role by {@link #effectiveScope()}
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step(String role, String channel, Integer budgetMinutes, String script, String scope) {

        public static final String DRIVER = "DRIVER";
        public static final String TRIP_CARRIER = "TRIP_CARRIER";
        public static final String ORG = "ORG";
        public static final java.util.Set<String> SCOPES = java.util.Set.of(DRIVER, TRIP_CARRIER, ORG);

        /** A step saved before steps had a scope. */
        public Step(String role, String channel, Integer budgetMinutes, String script) {
            this(role, channel, budgetMinutes, script, null);
        }

        /** The scope, or for an older step: Conductor is the driver, Transportista any carrier contact, else ORG. */
        public String effectiveScope() {
            return effectiveScope(scope, role);
        }

        /** Same reading for a step or an escalation target. */
        public static String effectiveScope(String scope, String role) {
            if (scope != null && !scope.isBlank()) {
                return scope;
            }
            String r = role == null ? "" : role.trim();
            if (r.equalsIgnoreCase("Conductor")) {
                return DRIVER;
            }
            if (r.equalsIgnoreCase("Transportista")) {
                return TRIP_CARRIER;
            }
            return ORG;
        }
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
     * @param open      CEL over {@code case} and the source
     * @param close     CEL over {@code case} and the source, such as
     *                  {@code case.closed_by_operator || signal.frame.events.exists(e, e.event_type == "x")}
     * @param levelDown the level follows the measure down while the case is open; otherwise it never goes down
     * @param note      optional CEL over {@code case} and the source: when it holds on a signal of an open case
     *                  that does not close it, the case's timeline gets an entry with the matching device event.
     *                  Null for none
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Lifecycle(String open, String close, boolean levelDown,
            @JsonInclude(JsonInclude.Include.NON_NULL) String note) {

        /** A blank note rule is none. */
        public Lifecycle {
            note = note == null || note.isBlank() ? null : note;
        }

        /** A lifecycle without a note rule. */
        public Lifecycle(String open, String close, boolean levelDown) {
            this(open, close, levelDown, null);
        }

        /** A lifecycle whose level never goes down. */
        public Lifecycle(String open, String close) {
            this(open, close, false);
        }
    }

    /**
     * Raise the level by {@code raiseLevels} when the same {@code entity} repeats {@code count} times in
     * {@code days}.
     *
     * @param entity what repeats: {@code vehicle} or {@code driver}; null means the vehicle
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Recurrence(boolean enabled, int count, int days, int raiseLevels, String entity) {

        public static final String VEHICLE = "vehicle";
        public static final String DRIVER = "driver";

        /** A recurrence counted per vehicle. */
        public Recurrence(boolean enabled, int count, int days, int raiseLevels) {
            this(enabled, count, days, raiseLevels, VEHICLE);
        }
    }
}
