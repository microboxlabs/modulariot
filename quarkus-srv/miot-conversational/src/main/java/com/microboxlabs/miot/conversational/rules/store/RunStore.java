package com.microboxlabs.miot.conversational.rules.store;

import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.StoredEvent;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Events, runs and the messages of runs. */
public interface RunStore {

    /** A run for the Activity list, with its rule's name, its event's type and its event's symptomName and assetId. */
    record RunRow(Run run, String ruleName, String eventType, String symptomName, String assetId) {
    }

    /** A message of a run, with the conversation's display name. */
    record RunMessage(String id, String runId, Integer step, String channel, String to, String toName,
            String status, String text, Instant at) {
    }

    StoredEvent saveEvent(StoredEvent event);

    Optional<StoredEvent> event(String id);

    /** With an {@code invocationKey} the rule already ran, the run that key started. */
    Run createRun(Run run);

    /** The run an invocation with this key started for the rule. */
    Optional<Run> invoked(String ruleId, String key);

    Optional<Run> find(String id);

    /**
     * Claims up to {@code limit} WAITING runs due at {@code now}: their {@code next_at} moves to
     * {@code now + lease}, so another pod skips them while this one works.
     */
    List<Run> claimDue(Instant now, Duration lease, int limit);

    /**
     * Writes status, step, next_at and last_error if the run is still WAITING; false when it no longer is. A null
     * last_error keeps the stored one, which a send job may have written meanwhile.
     */
    boolean updateIfWaiting(Run run);

    /** Writes a problem found after the step went out, such as a message that could not be sent. */
    void recordError(String runId, String error, Instant at);

    /** The WAITING runs about this context. */
    List<Run> waiting(String tenantCode, String contextKind, String contextKey);

    /**
     * The newest WAITING run that sent a real message on this conversation. Test runs, SIMULATED messages and
     * failed sends do not count.
     */
    Optional<Run> waitingOnConversation(String tenantCode, String conversationId);

    /** Newest first; {@code ruleId} and {@code status} null mean all. */
    List<RunRow> list(String tenantCode, String ruleId, Run.Status status, int limit);

    /** The messages of these runs, oldest first. */
    List<RunMessage> messages(Collection<String> runIds);
}
