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
        List<Field> fields) {

    /** A single field of the channel's contract. */
    public record Field(String id, String type, boolean required) {
    }
}
