package com.microboxlabs.miot.trips.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * The steps a delivery goes through, read from the trip monitor's parameters:
 * <ul>
 * <li>{@code deliverySteps}: the steps in order, separated by commas, from {@link #STEPS}. Default: all of them.</li>
 * <li>{@code deliveryCompletesTrip}: the step that, once every load reached it and the monitoring closure is
 * confirmed, completes the trip. Without it nothing completes the trip on its own.</li>
 * <li>{@code deliveryProofRequired}: the first step needs a proof. Default true.</li>
 * <li>{@code deliveryConfirmOnProof}: a proof confirms the first step; otherwise it leaves it pending. Default
 * false.</li>
 * </ul>
 */
public record DeliveryCycle(List<String> steps, String completesTrip, boolean proofRequired,
        boolean confirmOnProof) {

    public static final String DELIVERED = "delivered";
    public static final String ACCEPTED = "accepted";
    public static final String SETTLED = "settled";
    public static final List<String> STEPS = List.of(DELIVERED, ACCEPTED, SETTLED);
    public static final DeliveryCycle DEFAULT = new DeliveryCycle(STEPS, null, true, false);

    public static final String STEPS_PARAM = "deliverySteps";
    public static final String COMPLETES_TRIP_PARAM = "deliveryCompletesTrip";
    public static final String PROOF_REQUIRED_PARAM = "deliveryProofRequired";
    public static final String CONFIRM_ON_PROOF_PARAM = "deliveryConfirmOnProof";

    public DeliveryCycle {
        steps = List.copyOf(steps);
    }

    /** Refuses unknown steps, steps out of order, and a completing step outside the cycle. */
    public static DeliveryCycle of(Map<String, Object> params) {
        if (params == null) {
            return DEFAULT;
        }
        List<String> steps = STEPS;
        if (params.get(STEPS_PARAM) instanceof String text && !text.isBlank()) {
            steps = Arrays.stream(text.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            if (steps.isEmpty()) {
                throw new IllegalArgumentException(STEPS_PARAM + " must list at least one step");
            }
            int last = -1;
            for (String s : steps) {
                int i = STEPS.indexOf(s);
                if (i <= last) {
                    throw new IllegalArgumentException(STEPS_PARAM + " lists steps of " + String.join(", ", STEPS)
                            + ", in that order and once each");
                }
                last = i;
            }
        } else if (params.containsKey(STEPS_PARAM)) {
            throw new IllegalArgumentException(STEPS_PARAM + " must list at least one step");
        }
        String completes = null;
        Object c = params.get(COMPLETES_TRIP_PARAM);
        if (c instanceof String text && !text.isBlank()) {
            completes = text.trim();
            if (!steps.contains(completes)) {
                throw new IllegalArgumentException(COMPLETES_TRIP_PARAM + " must be one of the delivery steps");
            }
        } else if (c != null) {
            throw new IllegalArgumentException(COMPLETES_TRIP_PARAM + " must be one of the delivery steps");
        }
        return new DeliveryCycle(steps, completes, bool(params, PROOF_REQUIRED_PARAM, true),
                bool(params, CONFIRM_ON_PROOF_PARAM, false));
    }

    public String first() {
        return steps.get(0);
    }

    /** The step before {@code step} in this cycle, or null for the first. */
    public String before(String step) {
        int i = steps.indexOf(step);
        return i > 0 ? steps.get(i - 1) : null;
    }

    private static boolean bool(Map<String, Object> params, String name, boolean fallback) {
        Object v = params.get(name);
        if (v == null) {
            return fallback;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        throw new IllegalArgumentException(name + " must be true or false");
    }
}
