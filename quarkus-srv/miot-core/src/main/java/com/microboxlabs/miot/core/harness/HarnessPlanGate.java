package com.microboxlabs.miot.core.harness;

import io.smallrye.mutiny.Uni;
import java.util.Map;

/**
 * Decides whether an organization's member may start a harness run, and which
 * models the chat picker offers. The seat plan lives in miot-integrations; with
 * that component off, {@link AllowAllHarnessPlanGate} allows every run.
 */
public interface HarnessPlanGate {

    /**
     * The model to run when the request names none, or null to let the harness
     * pick its own default.
     */
    Uni<String> defaultModel(String organization);

    /**
     * @param organization the org slug
     * @param userEmail    the caller, or null for a machine token
     * @param model        the model the run names, or the one {@link #defaultModel}
     *                     resolved; null when neither gave one
     * @return null when the run may start, else why not
     */
    Uni<Refusal> checkRun(String organization, String userEmail, String model);

    /**
     * The harness {@code GET /models} answer as this organization should see it.
     * Returns {@code models} unchanged when there is nothing to add or remove.
     */
    Uni<Map<String, Object>> models(String organization, Map<String, Object> models);

    /** False when {@link #models} never changes the answer, so it need not be parsed. */
    boolean changesModels();

    /**
     * Why a run was refused. {@code code} is stable for clients to translate;
     * {@code message} is for logs and API callers.
     */
    record Refusal(int status, String code, String message) {
    }
}
