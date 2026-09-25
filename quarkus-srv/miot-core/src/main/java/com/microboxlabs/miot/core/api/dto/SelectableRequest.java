package com.microboxlabs.miot.core.api.dto;

import com.microboxlabs.miot.core.selectable.SelectableGroup;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectableSettings;
import com.microboxlabs.miot.core.selectable.SelectableSource;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import java.util.List;
import java.util.Map;

/**
 * Full replacement of one selectable. Texts are per language ({@code {"es": ..., "en": ...}}).
 * An option without a value gets one made from its label. Omitted settings,
 * groups and source mean the defaults, no groups and a static list.
 */
public record SelectableRequest(
        Map<String, String> name,
        Map<String, String> description,
        SelectionMode mode,
        SelectableSettings settings,
        List<SelectableGroup> groups,
        SelectableSource source,
        List<SelectableOption> options) {
}
