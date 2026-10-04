package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableDefaults;
import com.microboxlabs.miot.core.selectable.SelectableDefaultsFile;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * The treatment-form lists an organization starts with, read from
 * {@value #RESOURCE}. Option values are stable so actions recorded against
 * them keep resolving; {@code call_result} uses the values the call form
 * keys its labels on.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TreatmentFormSelectables implements SelectableDefaults {

    static final String RESOURCE = "/selectables/defaults/treatment-form.json";

    public static final String RESULT_COMMITS = "result_commits";
    public static final String RESULT_CORRECTED = "result_corrected";
    public static final String RESULT_REJECTS = "result_rejects";
    public static final String RESULT_NO_ANSWER = "result_no_answer";
    public static final String RESULT_VOICEMAIL = "result_voicemail";

    private final List<Selectable> lists = SelectableDefaultsFile.read(TreatmentFormSelectables.class, RESOURCE);

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return lists;
    }
}
