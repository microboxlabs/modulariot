package com.microboxlabs.miot.core.selectable;

import java.util.Map;

/**
 * Fired after every selectable write, so a component that keeps an audit log
 * can record it. {@code action} is {@code selectable.replaced},
 * {@code selectable.deleted}, {@code selectable.reset} or
 * {@code selectable.bindings_updated}.
 */
public record SelectableChanged(
        String tenantCode,
        String actor,
        String action,
        String key,
        Map<String, Object> details) {
}
