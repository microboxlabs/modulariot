package com.microboxlabs.miot.core.api.dto;

import java.util.Map;

/** Form field key to selectable key. Fields not listed keep their current binding. */
public record SelectableBindingsRequest(Map<String, String> bindings) {
}
