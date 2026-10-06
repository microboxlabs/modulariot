package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Finding;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Report;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Severity;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomSummary;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The versions the evaluator runs for an organization and a data source: the
 * version in force of every Activo and En prueba symptom that reads that
 * source. A version is checked against its source and compiled once; a new
 * version or new source fields check and compile again. The symptom's current
 * state is applied on every lookup, so switching state needs no recompile.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorCatalog {

    static final String ACTIVE_NEEDS_ENGINE = "El motor aún no evalúa todas las variables de esta versión.";

    private final SymptomCatalogService catalog;
    private final DataSourceService sources;
    /** One entry per symptom; a new version or new source fields replace it. */
    private final Map<UUID, Entry> checked = new ConcurrentHashMap<>();

    /** A version that is in force but cannot run, and why. */
    public record Skipped(UUID definitionId, String version, String reason) {
    }

    public record Versions(List<CompiledSymptom> symptoms, List<Skipped> skipped) {
    }

    /**
     * What one version is against one set of source fields, whatever the symptom's state.
     *
     * @param error      the first error of the checks, or null when it can run
     * @param testOnly   it reads fields the engine does not evaluate yet, so it can only run in test
     * @param compiled   the compiled rules, or null when {@code error} is set
     */
    private record Entry(String version, List<SourceField> fields, String error, boolean testOnly,
            CompiledSymptom compiled) {
    }

    @Inject
    public EvaluatorCatalog(SymptomCatalogService catalog, DataSourceService sources) {
        this.catalog = catalog;
        this.sources = sources;
    }

    public Versions forSource(String tenantCode, String sourceKey) {
        Optional<DataSource> source = sources.find(tenantCode, sourceKey);
        if (source.isEmpty()) {
            return new Versions(List.of(), List.of());
        }
        DataSource src = source.get();
        List<CompiledSymptom> out = new ArrayList<>();
        List<Skipped> skipped = new ArrayList<>();
        for (SymptomSummary s : catalog.list(tenantCode)) {
            SymptomVersion v = s.current();
            SymptomState state = s.definition().state();
            if (state == SymptomState.OFF || v == null || !sourceKey.equals(sourceOf(v.spec(), s))) {
                continue;
            }
            Entry entry = checked.compute(s.definition().id(), (id, old) ->
                    old != null && old.version().equals(v.version()) && old.fields().equals(src.fields()) ? old
                            : check(id, v, src));
            if (entry.error() != null) {
                skipped.add(new Skipped(s.definition().id(), v.version(), entry.error()));
            } else if (state == SymptomState.ACTIVE && entry.testOnly()) {
                skipped.add(new Skipped(s.definition().id(), v.version(), ACTIVE_NEEDS_ENGINE));
            } else {
                out.add(entry.compiled().withState(state));
            }
        }
        return new Versions(out, skipped);
    }

    /** Checks the version without its recorded state, which may no longer be the symptom's, and compiles it. */
    private static Entry check(UUID id, SymptomVersion v, DataSource src) {
        SymptomSpec spec = v.spec().withState(null);
        Report report = SpecValidator.validate(spec, src);
        Optional<Finding> error = report.findings().stream().filter(f -> f.severity() == Severity.ERROR).findFirst();
        if (error.isPresent()) {
            return new Entry(v.version(), src.fields(), error.get().message(), report.needsTestOnly(), null);
        }
        CompiledSymptom compiled = CompiledSymptom.compile(id, v.version(), SymptomState.TEST, v.spec(), src);
        return new Entry(v.version(), src.fields(), null, report.needsTestOnly(), compiled);
    }

    private static String sourceOf(SymptomSpec spec, SymptomSummary s) {
        return spec.source() == null || spec.source().isBlank() ? s.definition().sourceKey() : spec.source();
    }

    int cached() {
        return checked.size();
    }
}
