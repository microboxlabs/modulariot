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
 * The families a symptom can belong to: the organization's
 * {@value #KEY} list in Ajustes › Seleccionables. Organizations whose lists
 * were created before this one existed get the defaults from {@value #RESOURCE}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomFamilies implements SelectableDefaults {

    public static final String KEY = "symptom_families";
    static final String RESOURCE = "/selectables/defaults/symptom-families.json";

    private final List<Selectable> lists = SelectableDefaultsFile.read(SymptomFamilies.class, RESOURCE);
    private final Function<String, Selectable> tenantList;

    @Inject
    public SymptomFamilies(SelectableService selectables) {
        this(tenant -> selectables.get(tenant, KEY));
    }

    /** {@code tenantList} returns the organization's list, or throws {@link NoSuchElementException} without one. */
    public SymptomFamilies(Function<String, Selectable> tenantList) {
        this.tenantList = tenantList;
    }

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return lists;
    }

    /** The organization's families, or the defaults when it has no such list. */
    public List<SelectableOption> options(String tenantCode) {
        try {
            return tenantList.apply(tenantCode).options();
        } catch (NoSuchElementException e) {
            return lists.get(0).options();
        }
    }
}
