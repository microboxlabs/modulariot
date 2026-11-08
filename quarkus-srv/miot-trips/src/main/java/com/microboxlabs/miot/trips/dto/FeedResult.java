package com.microboxlabs.miot.trips.dto;

import java.util.List;

/**
 * What a reconcile decided and did for one service. {@code action} is create, update, skip (nothing to
 * do) or report (cannot be created: see {@code errors}). {@code operations} are the
 * steps done, or the steps it would do when {@code dryRun}. {@code warnings} do not stop it.
 *
 * <p>Errors: a required resource that is missing or not in the fleet and cannot be registered, missing planned
 * times, actual times out of order. A truck, trailer, driver or carrier that is inactive in the fleet is not an
 * error: the service uses it, the fleet is not changed, and {@code warnings} has
 * {@code "<type> <key> is inactive in the fleet"}.
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
