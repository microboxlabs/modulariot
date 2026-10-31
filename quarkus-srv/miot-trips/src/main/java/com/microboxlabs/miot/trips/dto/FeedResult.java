package com.microboxlabs.miot.trips.dto;

import java.util.List;

/**
 * What a reconcile decided and did for one service. {@code action} is create, update, skip (nothing to
 * do) or report (cannot be created: see {@code errors}). {@code operations} are the
 * steps done, or the steps it would do when {@code dryRun}. {@code warnings} do not stop it.
 */
public record FeedResult(
        String externalCode,
        String action,
        boolean dryRun,
        String mandateId,
        String tripId,
        List<String> operations,
        List<String> warnings,
        List<String> errors) {
}
