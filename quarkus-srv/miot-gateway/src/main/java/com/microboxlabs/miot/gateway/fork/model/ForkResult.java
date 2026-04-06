package com.microboxlabs.miot.gateway.fork.model;

import java.util.List;

/**
 * Outcome of processing one fork rule against an incoming request.
 * Returned by ForkEngine.process() so callers can attach response headers.
 */
public record ForkResult(
        String ruleId,
        Outcome outcome,
        String key,
        List<String> dispatchedTargets
) {
    public enum Outcome { forwarded, discarded, error }

    public static ForkResult forwarded(String ruleId, String key, List<String> targets) {
        return new ForkResult(ruleId, Outcome.forwarded, key, List.copyOf(targets));
    }

    public static ForkResult discarded(String ruleId, String key) {
        return new ForkResult(ruleId, Outcome.discarded, key, List.of());
    }

    public static ForkResult error(String ruleId, String key) {
        return new ForkResult(ruleId, Outcome.error, key, List.of());
    }
}
