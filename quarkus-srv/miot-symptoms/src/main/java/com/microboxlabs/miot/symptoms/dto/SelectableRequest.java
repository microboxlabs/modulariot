package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.SelectableOption;
import com.microboxlabs.miot.symptoms.domain.SelectionMode;
import java.util.List;

/** Full replacement of one selectable. Options without an id get one assigned. */
public record SelectableRequest(
        String name,
        String description,
        SelectionMode mode,
        List<SelectableOption> options) {
}
