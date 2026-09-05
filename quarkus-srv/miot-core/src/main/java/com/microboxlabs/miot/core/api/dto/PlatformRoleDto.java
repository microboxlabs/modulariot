package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/**
 * Who holds a platform role.
 *
 * @param assigneeIds those granted in the database, which this API can change
 * @param bootstrapAssigneeIds those granted by {@code miot.platform.owner-emails},
 *     which only a deployment change can. Reported so the settings UI can show
 *     them as read-only rather than appear to have lost them.
 */
public record PlatformRoleDto(
        String roleCode, List<String> assigneeIds, List<String> bootstrapAssigneeIds) {
}
