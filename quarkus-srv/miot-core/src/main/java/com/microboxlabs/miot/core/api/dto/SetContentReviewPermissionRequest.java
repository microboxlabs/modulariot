package com.microboxlabs.miot.core.api.dto;

import java.util.List;

/** Full replacement request for the content-review auto-approval policy. */
public record SetContentReviewPermissionRequest(boolean enabled, List<String> assigneeIds) {
}
