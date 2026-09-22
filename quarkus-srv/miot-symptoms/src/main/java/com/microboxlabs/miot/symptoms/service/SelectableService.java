package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.Selectable;
import com.microboxlabs.miot.symptoms.domain.SelectableOption;
import com.microboxlabs.miot.symptoms.domain.SelectionMode;
import com.microboxlabs.miot.symptoms.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.symptoms.dto.SelectableRequest;
import com.microboxlabs.miot.symptoms.persistence.SelectableRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Option lists behind the treatment forms. A tenant that has never edited
 * them gets the platform defaults seeded on first read, so the forms always
 * have something to show and the settings page always has something to edit.
 */
@ApplicationScoped
public class SelectableService {

    static final String ENTITY = "selectable";
    private static final Pattern KEY = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");
    private static final String SYSTEM_ACTOR = "system:defaults";

    private final SelectableRepository repository;
    private final AuditService audit;

    @Inject
    public SelectableService(SelectableRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    public List<Selectable> list(String tenantCode) {
        List<Selectable> existing = repository.list(tenantCode);
        if (!existing.isEmpty()) {
            return existing;
        }
        for (Selectable s : defaults(tenantCode)) {
            repository.insertIfAbsent(s);
        }
        return repository.list(tenantCode);
    }

    public Selectable get(String tenantCode, String key) {
        validateKey(key);
        return repository.find(tenantCode, key)
                .or(() -> defaults(tenantCode).stream().filter(s -> s.key().equals(key)).findFirst()
                        .map(s -> {
                            repository.insertIfAbsent(s);
                            return s;
                        }))
                .orElseThrow(() -> new NoSuchElementException("selectable not found: " + key));
    }

    public Selectable replace(String tenantCode, String actor, String key, SelectableRequest req) {
        validateKey(key);
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (req.mode() == null) {
            throw new IllegalArgumentException("mode is required (SINGLE or MULTIPLE)");
        }
        List<SelectableOption> options = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (SelectableOption o : req.options() == null ? List.<SelectableOption>of() : req.options()) {
            if (o == null || o.name() == null || o.name().isBlank()) {
                throw new IllegalArgumentException("every option needs a name");
            }
            String id = o.id() == null || o.id().isBlank() ? newOptionId() : o.id().trim();
            if (!ids.add(id)) {
                throw new IllegalArgumentException("duplicate option id: " + id);
            }
            options.add(new SelectableOption(id, o.name().trim(), o.description() == null ? "" : o.description()));
        }
        Selectable saved = repository.upsert(new Selectable(
                tenantCode, key, req.name().trim(), req.description(), req.mode(), options, actor, null));
        audit.record(tenantCode, actor, "selectable.replaced", ENTITY, key, null,
                Map.of("name", saved.name(), "options", options.size()));
        return saved;
    }

    public Map<String, String> bindings(String tenantCode) {
        return repository.listBindings(tenantCode);
    }

    public Map<String, String> updateBindings(String tenantCode, String actor, SelectableBindingsRequest req) {
        if (req == null || req.bindings() == null || req.bindings().isEmpty()) {
            throw new IllegalArgumentException("bindings is required");
        }
        Set<String> known = new HashSet<>();
        list(tenantCode).forEach(s -> known.add(s.key()));
        for (Map.Entry<String, String> e : req.bindings().entrySet()) {
            validateKey(e.getKey());
            validateKey(e.getValue());
            if (!known.contains(e.getValue())) {
                throw new IllegalArgumentException("unknown selectable: " + e.getValue());
            }
        }
        req.bindings().forEach((field, key) -> repository.upsertBinding(tenantCode, field, key, actor));
        audit.record(tenantCode, actor, "selectable.bindings_updated", ENTITY, "bindings", null,
                new LinkedHashMap<>(req.bindings()));
        return repository.listBindings(tenantCode);
    }

    static void validateKey(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("key must match [a-z][a-z0-9_]{1,63}: " + key);
        }
    }

    static String newOptionId() {
        return "opt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    /** Mirrors the lists the treatment forms shipped with before they became editable. */
    static List<Selectable> defaults(String tenantCode) {
        List<Selectable> out = new ArrayList<>();
        out.add(def(tenantCode, "call_result", "Resultado de la llamada", "Desenlace del contacto.",
                SelectionMode.SINGLE,
                "Contesta — se compromete a corregir",
                "Contesta — condición ya corregida",
                "Contesta — rechaza o discute",
                "No contesta",
                "Buzón de voz / apagado"));
        out.add(def(tenantCode, "call_tags", "Etiquetas de llamada", "Etiquetas opcionales para clasificar el tratamiento.",
                SelectionMode.MULTIPLE,
                "Ruta con problemas",
                "Conductor problemático",
                "Prueba"));
        out.add(def(tenantCode, "ignore_reason", "Motivo para ignorar",
                "Por qué el evento es real pero no requiere gestión.",
                SelectionMode.SINGLE,
                "Falso positivo — mapa/límite incorrecto",
                "Zona de sombra GPS conocida",
                "Maniobra justificada (adelantamiento)",
                "Condición operativa autorizada",
                "Síntoma duplicado",
                "Otro (detallar en la nota)"));
        out.add(def(tenantCode, "ignore_duration", "Duración de la omisión", "Por cuánto tiempo se silencia la condición.",
                SelectionMode.SINGLE,
                "5 minutos", "30 minutos", "1 hora", "2 horas", "Indefinidamente"));
        out.add(def(tenantCode, "invalidate_reason", "Motivo de invalidación",
                "Por qué el síntoma NO es real (dato o regla).",
                SelectionMode.SINGLE,
                "Dato GPS incorrecto",
                "Mapa/límite incorrecto",
                "Regla mal calibrada",
                "Síntoma duplicado",
                "Otro (detallar en la nota)"));
        return out;
    }

    private static Selectable def(
            String tenantCode, String key, String name, String description, SelectionMode mode, String... names) {
        List<SelectableOption> options = new ArrayList<>();
        for (int i = 0; i < names.length; i++) {
            options.add(new SelectableOption(key + "_" + (i + 1), names[i], ""));
        }
        return new Selectable(tenantCode, key, name, description, mode, options, SYSTEM_ACTOR, null);
    }
}
