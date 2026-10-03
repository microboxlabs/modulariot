package com.microboxlabs.miot.symptoms.catalog.mcp;

import com.microboxlabs.miot.core.mcp.McpCaller;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService.Preview;
import com.microboxlabs.miot.symptoms.catalog.service.PreviewService;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Report;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.PublishPlan;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomDetail;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomFamilies;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * The Control Tower symptom catalog as MCP tools: the operations of
 * {@code /api/v1/orgs/{org}/control-tower/symptom-definitions} and
 * {@code .../data-sources}, under the same rules. Any member reads, checks
 * and previews; saving a draft, publishing, rolling back and changing the
 * state need an organization owner. Creating, forking and discarding are
 * left to the screen.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomTools {

    static final String ORGANIZATION = "The organization's slug, as in /api/v1/orgs/{slug}.";
    static final String SYMPTOM_ID = "The symptom's id (a UUID), from symptoms_list.";

    static final String SPEC = "A symptom spec as a JSON object with source, activation, measure, levels,"
            + " lifecycle and recurrence. Send the whole spec: read it with symptoms_get and change only what"
            + " you were asked to."
            + " source: the key of the data source the rules read (symptoms_sources)."
            + " activation: a CEL expression over the source's root object (e.g. signal.trip.active &&"
            + " signal.gps.speed_kmh > 0) that returns bool; it says which situations are candidates."
            + " measure: {expression, label, unit}; expression is CEL over the same root that returns a number,"
            + " e.g. signal.gps.speed_kmh - signal.road.maxspeed_osm; null for a symptom with a fixed level."
            + " levels: the four ICU levels, lowest first, each {icu, applies, when, response}. icu is 1 to 4:"
            + " 1 Bajo observación, 2 Comprometida, 3 Crítica, 4 Código negro. applies=false means the symptom"
            + " never reaches that level. when is CEL over medida (the measure's value) and sostenido_s"
            + " (seconds the condition has held), e.g. medida >= 11 && medida < 21; the case gets the highest"
            + " level whose when is true. response: {operator, slaMinutes, steps: [{role, channel,"
            + " budgetMinutes, script}], notices: [{when, channel, connectionId, templateId, recipient}],"
            + " evidence: [text], ignorable}."
            + " lifecycle: {open, close}, CEL over caso (caso.condicion_s, caso.normal_s, caso.edad_h,"
            + " caso.nivel, caso.cerrado_por_operador), e.g. open caso.condicion_s >= 0, close"
            + " caso.normal_s >= 120."
            + " recurrence (optional): {enabled, count, days, raiseLevels} raises the level when the same"
            + " plate repeats count times in days."
            + " family (optional): a symptom_families value (symptoms_families); null keeps the symptom's."
            + " state (optional): OFF, TEST or ACTIVE, applied when this version is published; null keeps the"
            + " symptom's (a first version starts TEST).";

    static final String BUMPS = " The version number follows from what changed against the version in force:"
            + " MAJOR when the source, the activation or the measure expression changes; MINOR when a level's"
            + " threshold (when), a level turned on or off, the lifecycle or the recurrence changes; PATCH when"
            + " only responses, the family, the state, or the measure's label or unit, change. The first version is"
            + " 1.0.0.";

    /** A data source in the list, without its fields and samples. */
    public record SourceSummary(String key, String name, SourceKind kind, String root, String cadence,
            int fieldCount) {
    }

    /** The source list, or one source when a key was given. */
    public record Sources(List<SourceSummary> sources, DataSource source) {
    }

    /** A symptom in the tool's list; the spec is read with symptoms_get. */
    public record SymptomItem(SymptomDefinition definition, boolean hasDraft) {
    }

    public record Symptoms(List<SymptomItem> symptoms) {
    }

    public record Families(List<SelectableOption> families) {
    }

    private final McpCaller caller;
    private final SymptomCatalogService catalog;
    private final DataSourceService sources;
    private final PreviewService previews;
    private final SymptomFamilies families;

    @Inject
    public SymptomTools(McpCaller caller, SymptomCatalogService catalog, DataSourceService sources,
            PreviewService previews, SymptomFamilies families) {
        this.caller = caller;
        this.catalog = catalog;
        this.sources = sources;
        this.previews = previews;
        this.families = families;
    }

    @Tool(name = "symptoms_list", structuredContent = true,
            description = "The organization's Control Tower symptoms: key, name, family, the data source they"
                    + " read, state (OFF: not evaluated; TEST: evaluated and shown as \"En prueba\", not sent to"
                    + " operators; ACTIVE: in force), the version in force, and whether a draft is pending.",
            annotations = @Tool.Annotations(title = "List symptoms", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Symptoms> list(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.member(organization)
                .flatMap(in -> work(() -> new Symptoms(catalog.list(in.tenantCode()).stream()
                        .map(s -> new SymptomItem(s.definition(), s.hasDraft()))
                        .toList())));
    }

    @Tool(name = "symptoms_get", structuredContent = true,
            description = "One symptom: its definition, the version in force with its spec (the CEL rules for"
                    + " activation, measure, levels and lifecycle, and the response per level), the pending draft"
                    + " if any, and the published versions with who published them and why. Use it to answer"
                    + " what a symptom detects, at which thresholds each level fires, and why a case fired.",
            annotations = @Tool.Annotations(title = "Get a symptom", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<SymptomDetail> get(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId) {
        return caller.member(organization)
                .flatMap(in -> work(() -> catalog.get(in.tenantCode(), uuid(symptomId))));
    }

    @Tool(name = "symptoms_families", structuredContent = true,
            description = "The families a symptom can belong to (Ajustes › Seleccionables › Familias de"
                    + " síntomas): each value, which is what a spec's family holds, and its label per language.",
            annotations = @Tool.Annotations(title = "List symptom families", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Families> families(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.member(organization)
                .flatMap(in -> work(() -> new Families(families.options(in.tenantCode()))));
    }

    @Tool(name = "symptoms_sources", structuredContent = true,
            description = "The data sources symptom rules can read. Without key: the list of sources. With key:"
                    + " that source with each field (its CEL path such as signal.gps.speed_kmh, type, unit,"
                    + " origin, and whether the engine evaluates it today) and sample objects. Rules on a field"
                    + " the engine does not evaluate yet can only be published as TEST.",
            annotations = @Tool.Annotations(title = "List data sources", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Sources> sources(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = "A source's key, e.g. gps_signal. Leave it out to list the sources.",
                    required = false) String key) {
        return caller.member(organization).flatMap(in -> work(() -> key == null || key.isBlank()
                ? new Sources(sources.list(in.tenantCode()).stream().map(SymptomTools::summary).toList(), null)
                : new Sources(null, sources.get(in.tenantCode(), key))));
    }

    @Tool(name = "symptoms_validate", structuredContent = true,
            description = "Checks a spec against its data source: CEL syntax and types, levels that overlap or"
                    + " leave gaps, a missing lifecycle, and fields the engine cannot evaluate yet. Returns"
                    + " findings, each with section, severity (ERROR or WARNING), message and position. Any"
                    + " ERROR blocks publishing; a finding in section engine means it can only be published as"
                    + " TEST. Leave spec out to check the saved draft. Run it before proposing a change.",
            annotations = @Tool.Annotations(title = "Validate a symptom spec", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Report> validate(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId,
            @ToolArg(description = SPEC + " Leave it out to check the saved draft.", required = false)
            SymptomSpec spec) {
        return caller.member(organization)
                .flatMap(in -> work(() -> catalog.validate(in.tenantCode(), uuid(symptomId), spec)));
    }

    @Tool(name = "symptoms_preview", structuredContent = true,
            description = "Runs a spec on its data source's samples and says, per sample, whether the symptom"
                    + " activates, the measure's value, the level reached (1 to 4, or null) and any error. Leave"
                    + " spec out to preview the saved draft, or the version in force when there is no draft."
                    + " Use it to show the effect of a threshold change before proposing it.",
            annotations = @Tool.Annotations(title = "Preview a symptom spec", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Preview> preview(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId,
            @ToolArg(description = SPEC + " Leave it out to preview the saved draft.", required = false)
            SymptomSpec spec) {
        return caller.member(organization)
                .flatMap(in -> work(() -> previews.preview(in.tenantCode(), uuid(symptomId), spec)));
    }

    @Tool(name = "symptoms_plan_publish", structuredContent = true,
            description = "What publishing the saved draft would do, without publishing: the changes against"
                    + " the version in force (each with its section, bump and a text in Spanish), the computed"
                    + " bump, the next version number and the validation findings. nextVersion is null when"
                    + " nothing changed." + BUMPS + " Call it after saving a draft and before asking the owner"
                    + " to publish.",
            annotations = @Tool.Annotations(title = "Plan a symptom publish", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<PublishPlan> plan(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId) {
        return caller.member(organization)
                .flatMap(in -> work(() -> catalog.plan(in.tenantCode(), uuid(symptomId))));
    }

    @Tool(name = "symptoms_save_draft", structuredContent = true,
            description = "Saves a spec as the symptom's draft, replacing any draft already there. This is how"
                    + " to propose a change: nothing is evaluated differently until the draft is published. The"
                    + " draft may have errors; run symptoms_validate and symptoms_plan_publish next. Needs an"
                    + " organization owner.",
            annotations = @Tool.Annotations(title = "Save a symptom draft", readOnlyHint = false,
                    destructiveHint = true, idempotentHint = true, openWorldHint = false))
    public Uni<SymptomVersion> saveDraft(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId,
            @ToolArg(description = SPEC) SymptomSpec spec) {
        return caller.owner(organization)
                .flatMap(in -> work(() -> catalog.saveDraft(in.tenantCode(), in.actor(), uuid(symptomId), spec)));
    }

    @Tool(name = "symptoms_publish", structuredContent = true,
            description = "Publishes the saved draft as a new version, which is then in force. Published"
                    + " versions are never edited. Refused when the draft has errors or nothing changed." + BUMPS
                    + " bump may raise the computed bump, never lower it. Only call it after the owner has seen"
                    + " the plan and explicitly confirmed. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Publish a symptom draft", readOnlyHint = false,
                    destructiveHint = true, idempotentHint = false, openWorldHint = false))
    public Uni<SymptomVersion> publish(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId,
            @ToolArg(description = "Why this version is published, in the owner's words. Required; it is kept"
                    + " in the version history.") String reason,
            @ToolArg(description = "PATCH, MINOR or MAJOR, to raise the computed bump. Leave it out to use the"
                    + " computed one.", required = false) VersionBump bump,
            @ToolArg(description = "The state after publishing: OFF, TEST or ACTIVE. Leave it out to use the"
                    + " draft's state, else the symptom's (TEST for a first version). ACTIVE is refused while the"
                    + " rules use fields the engine does not evaluate yet.", required = false)
            SymptomState state) {
        return caller.owner(organization).flatMap(in -> work(() -> catalog.publish(in.tenantCode(), in.actor(),
                uuid(symptomId), reason, bump, state)));
    }

    @Tool(name = "symptoms_rollback", structuredContent = true,
            description = "Publishes an earlier version's spec as a new version; history is never rewritten."
                    + " The new number follows the same bump rules against the version in force, and the state"
                    + " is kept. Only call it after the owner has explicitly confirmed. Needs an organization"
                    + " owner.",
            annotations = @Tool.Annotations(title = "Roll back a symptom", readOnlyHint = false,
                    destructiveHint = true, idempotentHint = false, openWorldHint = false))
    public Uni<SymptomVersion> rollback(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId,
            @ToolArg(description = "The published version to go back to, e.g. 1.2.0.") String version,
            @ToolArg(description = "Why, in the owner's words. \"Volver a <version>\" when left out.",
                    required = false) String reason) {
        return caller.owner(organization).flatMap(in -> work(() -> {
            if (version == null || version.isBlank()) {
                throw new IllegalArgumentException("version is required");
            }
            return catalog.rollback(in.tenantCode(), in.actor(), uuid(symptomId), version, reason);
        }));
    }

    @Tool(name = "symptoms_set_state", structuredContent = true,
            description = "Turns a symptom OFF (not evaluated), to TEST (evaluated, shown as \"En prueba\", not"
                    + " sent to operators) or ACTIVE (in force). A symptom needs a published version to leave"
                    + " OFF, and ACTIVE is refused while its rules use fields the engine does not evaluate yet."
                    + " Only call it after the owner has explicitly confirmed. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Set a symptom's state", readOnlyHint = false,
                    destructiveHint = true, idempotentHint = true, openWorldHint = false))
    public Uni<SymptomDefinition> setState(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = SYMPTOM_ID) String symptomId,
            @ToolArg(description = "OFF, TEST or ACTIVE.") SymptomState state) {
        return caller.owner(organization).flatMap(in -> work(() -> {
            if (state == null) {
                throw new IllegalArgumentException("state is required");
            }
            return catalog.setState(in.tenantCode(), in.actor(), uuid(symptomId), state);
        }));
    }

    private static SourceSummary summary(DataSource s) {
        return new SourceSummary(s.key(), s.name(), s.kind(), s.root(), s.cadence(),
                s.fields() == null ? 0 : s.fields().size());
    }

    private static UUID uuid(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("symptomId is required");
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("symptomId must be a UUID");
        }
    }

    private static <T> Uni<T> work(Supplier<T> call) {
        return Uni.createFrom().item(() -> guarded(call))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    /** What the REST resource answers 400, 404 or 409 for, the model gets as a failed tool call. */
    static <T> T guarded(Supplier<T> call) {
        try {
            return call.get();
        } catch (IllegalArgumentException | NoSuchElementException | IllegalStateException e) {
            throw new ToolCallException(e.getMessage(), e);
        }
    }
}
