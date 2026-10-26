package com.microboxlabs.miot.trips.service;

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
import java.util.function.BiFunction;

/**
 * The organization's {@value #TYPES} and {@value #REASONS} lists in Ajustes › Seleccionables. A type in the
 * {@value #REVIEW_GROUP} group needs review. A reason with a parent is offered only for that type. {@value #RESOURCE}
 * only seeds the lists.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripDocumentLists implements SelectableDefaults {

    public static final String TYPES = "trip_document_types";
    public static final String REASONS = "trip_document_reasons";
    public static final String REVIEW_GROUP = "review";
    static final String RESOURCE = "/selectables/defaults/trip-documents.json";
    static final int MAX_OPTIONS = 200;

    private final List<Selectable> lists = SelectableDefaultsFile.read(TripDocumentLists.class, RESOURCE);
    private final BiFunction<String, String, List<SelectableOption>> tenantOptions;

    @Inject
    public TripDocumentLists(SelectableService selectables) {
        this((tenant, key) -> selectables.options(tenant, key, null, null, MAX_OPTIONS));
    }

    /** {@code tenantOptions} throws {@link NoSuchElementException} when the organization has no such list. */
    public TripDocumentLists(BiFunction<String, String, List<SelectableOption>> tenantOptions) {
        this.tenantOptions = tenantOptions;
    }

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return lists;
    }

    /** The organization's document types. {@link NoSuchElementException} when it has no such list. */
    public List<SelectableOption> types(String tenantCode) {
        return options(tenantCode, TYPES);
    }

    public List<SelectableOption> reasons(String tenantCode) {
        return options(tenantCode, REASONS);
    }

    /** The type as the organization lists it; {@link IllegalArgumentException} for one it does not list. */
    public SelectableOption type(String tenantCode, String value) {
        return types(tenantCode).stream().filter(o -> o.value().equals(value) && !o.disabled()).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("unknown document type " + value));
    }

    public static boolean reviewable(SelectableOption type) {
        return REVIEW_GROUP.equals(type.group());
    }

    private List<SelectableOption> options(String tenantCode, String key) {
        try {
            return tenantOptions.apply(tenantCode, key);
        } catch (NoSuchElementException e) {
            throw new NoSuchElementException("the organization has no " + key + " list in its selectables", e);
        }
    }
}
