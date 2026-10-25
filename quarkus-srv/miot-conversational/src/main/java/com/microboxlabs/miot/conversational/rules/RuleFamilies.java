package com.microboxlabs.miot.conversational.rules;

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
 * The families a communication rule can belong to: the organization's {@value #KEY} list in Ajustes ›
 * Seleccionables. {@value #RESOURCE} only seeds that list for an organization.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class RuleFamilies implements SelectableDefaults {

    public static final String KEY = "communication_families";
    static final String RESOURCE = "/selectables/defaults/rule-families.json";
    static final int MAX_FAMILIES = 200;

    private final List<Selectable> lists = SelectableDefaultsFile.read(RuleFamilies.class, RESOURCE);
    private final Function<String, List<SelectableOption>> tenantOptions;

    @Inject
    public RuleFamilies(SelectableService selectables) {
        this(tenant -> selectables.options(tenant, KEY, null, null, MAX_FAMILIES));
    }

    /** {@code tenantOptions} throws {@link NoSuchElementException} when the organization has no such list. */
    public RuleFamilies(Function<String, List<SelectableOption>> tenantOptions) {
        this.tenantOptions = tenantOptions;
    }

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return lists;
    }

    /** The organization's families. {@link NoSuchElementException} when it has no such list. */
    public List<SelectableOption> options(String tenantCode) {
        try {
            return tenantOptions.apply(tenantCode);
        } catch (NoSuchElementException e) {
            throw new NoSuchElementException("the organization has no " + KEY + " list in its selectables", e);
        }
    }
}
