package com.microboxlabs.miot.core.api.dto;

import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import java.util.List;

/** Full replacement of one selectable. Options without an id get one assigned. */
public record SelectableRequest(
        String name,
        String description,
        SelectionMode mode,
        List<SelectableOption> options) {
}
