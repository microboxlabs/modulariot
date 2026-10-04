package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableDefaults;
import com.microboxlabs.miot.core.selectable.SelectableDefaultsFile;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectableService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.function.Function;

/**
 * The families a symptom can belong to: the organization's {@value #KEY} list in
 * Ajustes › Seleccionables, and nothing else. {@value #RESOURCE} only seeds that
 * list for a new organization.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomFamilies implements SelectableDefaults {

    public static final String KEY = "symptom_families";
    static final String RESOURCE = "/selectables/defaults/symptom-families.json";

    private final List<Selectable> lists = SelectableDefaultsFile.read(SymptomFamilies.class, RESOURCE);
    /** The most families the list is read with; the selectable service allows up to 200 options a call. */
    static final int MAX_FAMILIES = 200;

    private final Function<String, List<SelectableOption>> tenantOptions;

    @Inject
    public SymptomFamilies(SelectableService selectables) {
        this(tenant -> selectables.options(tenant, KEY, null, null, MAX_FAMILIES));
    }

    /**
     * {@code tenantOptions} returns the options of the organization's list, static or read from its source, or
     * throws {@link NoSuchElementException} when the organization has no such list.
     */
    public SymptomFamilies(Function<String, List<SelectableOption>> tenantOptions) {
        this.tenantOptions = tenantOptions;
    }

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return lists;
    }

    /** The organization's families; none when it has no such list. */
    public List<SelectableOption> options(String tenantCode) {
        try {
            return tenantOptions.apply(tenantCode);
        } catch (NoSuchElementException e) {
            return List.of();
        }
    }
}
