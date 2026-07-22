package com.microboxlabs.miot.core.api.dto;

/** Authoritative application permission decision for one organization subject. */
public record AuthorizationDecisionDto(
        String permissionCode,
        String subjectId,
        boolean allowed) {
}
