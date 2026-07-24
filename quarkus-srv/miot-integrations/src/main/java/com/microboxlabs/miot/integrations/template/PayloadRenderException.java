package com.microboxlabs.miot.integrations.template;

import java.util.List;

/**
 * The mapping could not produce a payload the channel will accept — a required field left
 * blank, or a value that will not coerce to its declared type.
 *
 * <p>Carries <b>every</b> problem, not just the first. An operator fixing a six-field mapping
 * should see all of it in one pass rather than rediscovering the next fault on each retry;
 * the same list backs the save-time check and the preview endpoint.
 *
 * <p>This is a permanent failure by nature: the same binding and the same context will fail
 * identically forever, so a dispatch that raises it should park rather than retry.
 */
public class PayloadRenderException extends RuntimeException {

    private final transient List<String> problems;

    public PayloadRenderException(List<String> problems) {
        super(String.join("; ", problems));
        this.problems = List.copyOf(problems);
    }

    public List<String> problems() {
        return problems;
    }
}
