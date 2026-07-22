package com.microboxlabs.miot.integrations.domain;

/**
 * How a GPS webhook subscription selects positions.
 *
 * <ul>
 *   <li>{@link #ALL_VISIBLE} — every asset the tenant can already see via
 *       {@code asset_client_map}</li>
 *   <li>{@link #RULES} — intersection of filter dimensions in {@code filter_json}</li>
 * </ul>
 */
public enum FilterMode {
    ALL_VISIBLE,
    RULES
}
