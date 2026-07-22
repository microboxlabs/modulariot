package com.microboxlabs.miot.core.api.dto;

/** A subject-to-permission authorization decision requested by an application service. */
public record AuthorizationCheckRequest(String permissionCode, String subjectId) {
}
