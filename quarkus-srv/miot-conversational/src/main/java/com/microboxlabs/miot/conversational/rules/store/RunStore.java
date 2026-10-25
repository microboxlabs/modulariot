package com.microboxlabs.miot.conversational.rules.store;

import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.StoredEvent;
import com.microboxlabs.miot.conversational.rules.TestSend;
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

    Run createRun(Run run);

    Optional<Run> find(String id);

    /**
     * Claims up to {@code limit} WAITING runs due at {@code now}: their {@code next_at} moves to
     * {@code now + lease}, so another pod skips them while this one works.
     */
    List<Run> claimDue(Instant now, Duration lease, int limit);

    /** Writes status, step, next_at and last_error if the run is still WAITING; false when it no longer is. */
    boolean updateIfWaiting(Run run);

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

    /** Keeps the draft and the person of a test send, beside its run. */
    void saveTestSend(TestSend testSend);

    Optional<TestSend> testSend(String runId);
}
