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
 * source. Compiled rules are kept per symptom and version, so a version is
 * compiled once; a new version or a new source schema compiles again.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorCatalog {

    private final SymptomCatalogService catalog;
    private final DataSourceService sources;
    /** One entry per symptom; a new version or new source fields replace it. */
    private final Map<UUID, Entry> compiled = new ConcurrentHashMap<>();

    /** A version that is in force but cannot run: its rules no longer pass its source's checks. */
    public record Skipped(UUID definitionId, String version, String reason) {
    }

    public record Versions(List<CompiledSymptom> symptoms, List<Skipped> skipped) {
    }

    private record Entry(String version, List<SourceField> fields, CompiledSymptom symptom) {
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
        List<CompiledSymptom> out = new ArrayList<>();
        List<Skipped> skipped = new ArrayList<>();
        for (SymptomSummary s : catalog.list(tenantCode)) {
            SymptomVersion v = s.current();
            SymptomState state = s.definition().state();
            if (state == SymptomState.OFF || v == null || !sourceKey.equals(sourceOf(v.spec(), s))) {
                continue;
            }
            Report report = SpecValidator.validate(v.spec(), source.get());
            Optional<Finding> error = report.findings().stream()
                    .filter(f -> f.severity() == Severity.ERROR)
                    .findFirst();
            if (error.isPresent()) {
                skipped.add(new Skipped(s.definition().id(), v.version(), error.get().message()));
                continue;
            }
            DataSource src = source.get();
            Entry entry = compiled.compute(s.definition().id(), (id, old) ->
                    old != null && old.version().equals(v.version()) && old.fields().equals(src.fields()) ? old
                            : new Entry(v.version(), src.fields(),
                                    CompiledSymptom.compile(id, v.version(), state, v.spec(), src)));
            CompiledSymptom c = entry.symptom();
            out.add(c.state() == state ? c : c.withState(state));
        }
        return new Versions(out, skipped);
    }

    private static String sourceOf(SymptomSpec spec, SymptomSummary s) {
        return spec.source() == null || spec.source().isBlank() ? s.definition().sourceKey() : spec.source();
    }

    int cached() {
        return compiled.size();
    }
}
