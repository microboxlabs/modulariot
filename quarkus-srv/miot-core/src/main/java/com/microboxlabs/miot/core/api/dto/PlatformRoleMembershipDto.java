package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/**
 * The platform roles the caller holds. Readable by any authenticated user so a
 * client can hide an administration surface it cannot use, rather than offering
 * it and letting the write fail.
 */
public record PlatformRoleMembershipDto(List<String> roleCodes) {
}
