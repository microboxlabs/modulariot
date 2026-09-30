package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionStatus;
import com.microboxlabs.miot.symptoms.catalog.service.SpecDiff.Change;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Report;
import com.microboxlabs.miot.symptoms.catalog.store.DataSourceStore;
import com.microboxlabs.miot.symptoms.catalog.store.SymptomCatalogStore;
import com.microboxlabs.miot.symptoms.service.AuditService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Symptom definitions and their versions: drafts, validation, publishing
 * with a computed semantic version, rollback, duplication and state.
 * Published versions are never edited.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomCatalogService {

    static final String ENTITY = "symptom";
    private static final Pattern KEY = Pattern.compile("^[a-z0-9][a-z0-9_-]{1,94}$");

    private final SymptomCatalogStore store;
    private final DataSourceStore sources;
    private final AuditService audit;

    public SymptomCatalogService(SymptomCatalogStore store, DataSourceStore sources, AuditService audit) {
        this.store = store;
        this.sources = sources;
        this.audit = audit;
    }

    /** A symptom with the spec in force, its draft if any, and its version history. */
    public record SymptomDetail(SymptomDefinition definition, SymptomVersion current, SymptomVersion draft,
            List<SymptomVersion> versions) {
    }

    /** A symptom in the catalog list. */
    public record SymptomSummary(SymptomDefinition definition, boolean hasDraft) {
    }

    /** What a publish would do: the changes, the computed bump, the next version and the checks. */
    public record PublishPlan(List<Change> changes, VersionBump bump, String nextVersion, Report report) {
    }

    public record CreateRequest(String key, String name, String family, String icon, String description,
            String sourceKey, Integer engineRuleId, SymptomSpec spec) {
    }

    public record IdentityRequest(String name, String family, String icon, String description) {
    }

    public List<SymptomSummary> list(String tenantCode) {
        Set<UUID> drafts = store.definitionsWithDraft(tenantCode);
        return store.listDefinitions(tenantCode).stream()
                .map(d -> new SymptomSummary(d, drafts.contains(d.id())))
                .toList();
    }

    public SymptomDetail get(String tenantCode, UUID id) {
        SymptomDefinition d = require(tenantCode, id);
        List<SymptomVersion> versions = store.listVersions(tenantCode, id);
        SymptomVersion draft = versions.stream().filter(v -> v.status() == VersionStatus.DRAFT).findFirst()
                .orElse(null);
        SymptomVersion current = d.currentVersion() == null ? null
                : versions.stream().filter(v -> d.currentVersion().equals(v.version())).findFirst().orElse(null);
        return new SymptomDetail(d, current, draft,
                versions.stream().filter(v -> v.status() == VersionStatus.PUBLISHED).toList());
    }

    public SymptomDetail create(String tenantCode, String actor, CreateRequest req) {
        return create(tenantCode, actor, req, null);
    }

    private SymptomDetail create(String tenantCode, String actor, CreateRequest req, UUID forkedFrom) {
        if (req == null || req.key() == null || !KEY.matcher(req.key()).matches()) {
            throw new IllegalArgumentException("key: lowercase letters, digits, - and _, 2 to 95 characters");
        }
        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        DataSource source = requireSource(tenantCode, req.sourceKey());
        if (store.findDefinitionByKey(tenantCode, req.key()).isPresent()) {
            throw new IllegalStateException("a symptom with key " + req.key() + " already exists");
        }
        OffsetDateTime now = now();
        SymptomDefinition d = store.insertDefinition(new SymptomDefinition(UUID.randomUUID(), tenantCode, req.key(),
                req.name().trim(), req.family(), req.icon(), req.description(), source.key(), req.engineRuleId(), null,
                forkedFrom, SymptomState.OFF, null, actor, now, actor, now));
        SymptomSpec spec = req.spec() == null ? emptySpec(source) : req.spec();
        store.saveDraft(SymptomVersion.draft(d.id(), tenantCode, spec, actor, now));
        audit.log(tenantCode, actor, "symptom.created", ENTITY, d.id().toString(), null, Map.of("key", d.key()));
        return get(tenantCode, d.id());
    }

    public SymptomDefinition updateIdentity(String tenantCode, String actor, UUID id, IdentityRequest req) {
        SymptomDefinition d = require(tenantCode, id);
        String name = req.name() == null || req.name().isBlank() ? d.name() : req.name().trim();
        SymptomDefinition saved = store.updateDefinition(new SymptomDefinition(d.id(), tenantCode, d.key(), name,
                orKeep(req.family(), d.family()), orKeep(req.icon(), d.icon()),
                orKeep(req.description(), d.description()), d.sourceKey(), d.engineRuleId(), d.templateKey(),
                d.forkedFromVersionId(), d.state(), d.currentVersion(), d.createdBy(), d.createdAt(), actor, now()));
        audit.log(tenantCode, actor, "symptom.renamed", ENTITY, id.toString(), null, Map.of("name", name));
        return saved;
    }

    /** Saves the draft; it may be invalid. Returns the draft and its checks. */
    public SymptomVersion saveDraft(String tenantCode, String actor, UUID id, SymptomSpec spec) {
        require(tenantCode, id);
        if (spec == null) {
            throw new IllegalArgumentException("spec is required");
        }
        SymptomVersion base = store.findDraft(tenantCode, id)
                .orElseGet(() -> SymptomVersion.draft(id, tenantCode, spec, actor, now()));
        SymptomVersion saved = store.saveDraft(base.withSpec(spec));
        audit.log(tenantCode, actor, "symptom.draft_saved", ENTITY, id.toString(), null, Map.of());
        return saved;
    }

    public void discardDraft(String tenantCode, String actor, UUID id) {
        require(tenantCode, id);
        store.deleteDraft(tenantCode, id);
        audit.log(tenantCode, actor, "symptom.draft_discarded", ENTITY, id.toString(), null, Map.of());
    }

    public Report validate(String tenantCode, UUID id, SymptomSpec spec) {
        SymptomDefinition d = require(tenantCode, id);
        SymptomSpec checked = spec != null ? spec : store.findDraft(tenantCode, id).map(SymptomVersion::spec)
                .orElseThrow(() -> new NoSuchElementException("no draft to check"));
        return SpecValidator.validate(checked, sources.find(tenantCode, sourceKey(checked, d)).orElse(null));
    }

    /** What publishing the draft would do, without publishing. */
    public PublishPlan plan(String tenantCode, UUID id) {
        SymptomDetail detail = get(tenantCode, id);
        if (detail.draft() == null) {
            throw new IllegalStateException("there is no draft to publish");
        }
        return plan(tenantCode, detail, detail.draft().spec());
    }

    public SymptomVersion publish(String tenantCode, String actor, UUID id, String reason, VersionBump requested,
            SymptomState state) {
        SymptomDetail detail = get(tenantCode, id);
        if (detail.draft() == null) {
            throw new IllegalStateException("there is no draft to publish");
        }
        PublishPlan plan = plan(tenantCode, detail, detail.draft().spec());
        return publish(tenantCode, actor, detail, detail.draft(), plan, reason, requested, state, null);
    }

    /** Publishes an old version's spec as a new version. History is never rewritten. */
    public SymptomVersion rollback(String tenantCode, String actor, UUID id, String version, String reason) {
        SymptomDetail detail = get(tenantCode, id);
        SymptomVersion old = store.findVersion(tenantCode, id, version)
                .filter(v -> v.status() == VersionStatus.PUBLISHED)
                .orElseThrow(() -> new NoSuchElementException("version not found: " + version));
        if (version.equals(detail.definition().currentVersion())) {
            throw new IllegalStateException(version + " is already the version in force");
        }
        SymptomVersion copy = SymptomVersion.draft(id, tenantCode, old.spec(), actor, now());
        PublishPlan plan = plan(tenantCode, detail, old.spec());
        String why = reason == null || reason.isBlank() ? "Volver a " + version : reason;
        return publish(tenantCode, actor, detail, copy, plan, why, null, detail.definition().state(), version);
    }

    /** Creates a new symptom from one version of this one. It starts off, with that spec as its draft. */
    public SymptomDetail fork(String tenantCode, String actor, UUID id, String version, String key, String name) {
        SymptomDefinition from = require(tenantCode, id);
        String v = version == null ? from.currentVersion() : version;
        SymptomVersion source = v == null ? store.findDraft(tenantCode, id).orElseThrow()
                : store.findVersion(tenantCode, id, v)
                        .orElseThrow(() -> new NoSuchElementException("version not found: " + v));
        SymptomDetail created = create(tenantCode, actor, new CreateRequest(key, name, from.family(), from.icon(),
                from.description(), from.sourceKey(), null, source.spec()), source.id());
        audit.log(tenantCode, actor, "symptom.forked", ENTITY, created.definition().id().toString(), null,
                Map.of("from", from.key(), "version", v == null ? "draft" : v));
        return created;
    }

    public SymptomDefinition setState(String tenantCode, String actor, UUID id, SymptomState state) {
        SymptomDetail detail = get(tenantCode, id);
        SymptomDefinition d = detail.definition();
        if (state != SymptomState.OFF && d.currentVersion() == null) {
            throw new IllegalStateException("publish a version before turning the symptom on");
        }
        if (state == SymptomState.ACTIVE && detail.current() != null && !activatable(tenantCode, detail)) {
            throw new IllegalStateException("the engine cannot evaluate this version yet; use TEST");
        }
        SymptomDefinition saved = store.updateDefinition(d.withCurrent(d.currentVersion(), state, actor, now()));
        audit.log(tenantCode, actor, "symptom.state_changed", ENTITY, id.toString(), null,
                Map.of("state", state.name()));
        return saved;
    }

    /** Differences between two published versions, oldest first. */
    public List<Change> compare(String tenantCode, UUID id, String from, String to) {
        require(tenantCode, id);
        SymptomVersion a = store.findVersion(tenantCode, id, from)
                .orElseThrow(() -> new NoSuchElementException("version not found: " + from));
        SymptomVersion b = store.findVersion(tenantCode, id, to)
                .orElseThrow(() -> new NoSuchElementException("version not found: " + to));
        return SpecDiff.changes(a.spec(), b.spec());
    }

    private SymptomVersion publish(String tenantCode, String actor, SymptomDetail detail, SymptomVersion version,
            PublishPlan plan, String reason, VersionBump requested, SymptomState state, String rolledBackFrom) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("reason is required");
        }
        if (!plan.report().publishable()) {
            throw new IllegalStateException("the draft has errors: " + plan.report().findings().get(0).message());
        }
        if (plan.bump() == null) {
            throw new IllegalStateException("nothing changed since " + detail.definition().currentVersion());
        }
        SymptomState next = state == null ? SymptomState.TEST : state;
        if (next == SymptomState.ACTIVE && plan.report().needsTestOnly()) {
            throw new IllegalStateException("the engine cannot evaluate this version yet; publish it as TEST");
        }
        VersionBump bump = requested != null && requested.compareTo(plan.bump()) > 0 ? requested : plan.bump();
        String number = SpecDiff.next(detail.definition().currentVersion(), bump);
        OffsetDateTime now = now();
        SymptomVersion saved = store.publish(
                version.published(number, bump, reason.trim(), rolledBackFrom, actor, now),
                detail.definition().withCurrent(number, next, actor, now));
        audit.log(tenantCode, actor, rolledBackFrom == null ? "symptom.published" : "symptom.rolled_back", ENTITY,
                detail.definition().id().toString(), null,
                Map.of("version", number, "bump", bump.name(), "state", next.name()));
        return saved;
    }

    private PublishPlan plan(String tenantCode, SymptomDetail detail, SymptomSpec spec) {
        List<Change> changes = SpecDiff.changes(detail.current() == null ? null : detail.current().spec(), spec);
        VersionBump bump = SpecDiff.bump(changes);
        Report report = SpecValidator.validate(spec,
                sources.find(tenantCode, sourceKey(spec, detail.definition())).orElse(null));
        return new PublishPlan(changes, bump,
                bump == null ? null : SpecDiff.next(detail.definition().currentVersion(), bump), report);
    }

    /** The version in force has no errors against its own source and needs nothing the engine lacks. */
    private boolean activatable(String tenantCode, SymptomDetail detail) {
        SymptomSpec spec = detail.current().spec();
        Report report = SpecValidator.validate(spec,
                sources.find(tenantCode, sourceKey(spec, detail.definition())).orElse(null));
        return report.publishable() && !report.needsTestOnly();
    }

    private SymptomDefinition require(String tenantCode, UUID id) {
        return store.findDefinition(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("symptom not found: " + id));
    }

    private DataSource requireSource(String tenantCode, String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("sourceKey is required");
        }
        return sources.find(tenantCode, key)
                .orElseThrow(() -> new IllegalArgumentException("unknown data source: " + key));
    }

    private static String sourceKey(SymptomSpec spec, SymptomDefinition d) {
        return spec.source() == null ? d.sourceKey() : spec.source();
    }

    private static SymptomSpec emptySpec(DataSource source) {
        return new SymptomSpec(source.key(), "", null, List.of(), new SymptomSpec.Lifecycle(
                "caso.condicion_s >= 0", "caso.normal_s >= 120"), null);
    }

    private static String orKeep(String value, String current) {
        return value == null ? current : value;
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }
}
