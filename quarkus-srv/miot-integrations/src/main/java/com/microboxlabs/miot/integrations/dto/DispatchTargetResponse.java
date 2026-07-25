package com.microboxlabs.miot.integrations.dto;

import java.util.List;

/**
 * One bindable channel, as the settings UI's channel picker renders it: a connection, the
 * operation to call on it, and the fields that operation's contract declares.
 *
 * <p>Exists so the drawer does not have to fetch connections, then operations, then parse
 * each {@code request_schema} itself. The field contract is derived server-side from the
 * same {@link com.microboxlabs.miot.integrations.template.PayloadSchema} the renderer uses,
 * so what the operator maps and what the dispatcher validates cannot disagree.
 */
public record DispatchTargetResponse(
        String connectionId,
        String connectionName,
        String providerType,
        String operationId,
        String operationName,
        String method,
        String path,
        List<Field> fields,
        List<String> templateRoots) {

    /**
     * A single row of the channel's contract.
     *
     * @param contextRoot the template root this row is read under, or null for an envelope field
     *     that sees the whole context. Sent as the contract's own view; once a binding declares an
     *     array's source the UI knows better from its own draft and should prefer that.
     * @param kind {@code "value"} for a scalar produced from a template, or {@code "collection"}
     *     for an array row naming where its elements come from. A collection row is never
     *     {@code required}: leaving it unmapped falls back rather than failing.
     */
    public record Field(
            String id, String type, boolean required, String contextRoot, String kind) {

        public static final String VALUE = "value";
        public static final String COLLECTION = "collection";
    }
}
