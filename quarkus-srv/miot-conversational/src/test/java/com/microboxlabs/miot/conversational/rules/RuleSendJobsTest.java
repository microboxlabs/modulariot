package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.DRIVER;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.PANIC_SPEC;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.client.WhatsAppSendException;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.jobs.WhatsAppSendJob;
import com.microboxlabs.miot.conversational.service.ContextMessage;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A step's WhatsApp and email messages go out as integration jobs: PENDING until their job sends them. */
class RuleSendJobsTest {

    private final RulesFixture f = new RulesFixture();

    @BeforeEach
    void panicRule() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        f.holdSends = true;
        f.engine.accept(RulesFixture.event("symptom.case.opened", "-7", RulesFixture.panic(4), false));
        f.engine.runDue();
    }

    private Message message() {
        return f.store.conversations.messages.get(0);
    }

    private Run run() {
        return f.store.runs.values().iterator().next();
    }

    @Test
    void theStepLeavesAPendingMessageAndOneJobForIt() {
        assertEquals(MessageStatus.PENDING, message().status());
        assertTrue(f.whatsappSent.isEmpty());
        AsyncJobSpec job = f.sendJobs.get(0);
        assertEquals(1, f.sendJobs.size());
        assertEquals(InternalJobTypes.WHATSAPP_SEND, job.jobType());
        assertEquals(ModulithJobHandler.EXECUTOR, job.executor());
        assertEquals(run().id(), job.correlationKey());
        assertEquals("conv:send:" + message().id(), job.dedupeKey());
        assertEquals(1, run().step(), "the run does not wait for the send");

        f.runSendJobs();
        assertEquals(MessageStatus.SENT, message().status());
        assertEquals("wamid.out-1", message().providerMessageId());
        assertEquals(DRIVER, f.whatsappSent.get(0).to());
    }

    @Test
    void aJobRunTwiceSendsOnce() {
        f.runSendJobs();
        new WhatsAppSendJob(f.whatsapp).handle(TENANT, f.sendJobs.get(0).payload());
        f.park(f.sendJobs.get(0), "late failure");
        assertEquals(1, f.whatsappSent.size());
        assertEquals(MessageStatus.SENT, message().status());
        assertNull(run().lastError(), "a late park must not mark a sent message's run as failed");
    }

    @Test
    void replayingTheStepKeepsTheSameQueuedMessage() {
        Message first = message();
        ContextMessage repeated = new ContextMessage(ContextKind.SYMPTOM_CASE, "-7", DRIVER, null, null, null,
                first.templateName(), "es_CL", java.util.Map.of(), null, first.body(), run().id(), 0);
        Message second = f.whatsapp.queueInContext(TENANT, repeated);
        assertEquals(first.id(), second.id());
        assertEquals(1, f.store.conversations.messages.size());
    }

    @Test
    void metaDownRetriesAndTheNextAttemptSends() {
        f.metaFailure = new WhatsAppSendException("Service unavailable", 503, null);
        f.runSendJobs();
        assertInstanceOf(RuntimeException.class, f.sendOutcomes.get(0));
        assertEquals(MessageStatus.PENDING, message().status());

        f.metaFailure = null;
        f.runSendJobs();
        assertEquals(MessageStatus.SENT, message().status());
        assertNull(run().lastError());
    }

    @Test
    void aSendMetaRefusesParksAtOnceAndTheRunRecordsIt() {
        f.metaFailure = new WhatsAppSendException("Invalid parameter", 400, null);
        f.runSendJobs();
        assertInstanceOf(NonRetryableJobException.class, f.sendOutcomes.get(0));
        assertEquals(MessageStatus.FAILED, message().status());
        assertEquals("Invalid parameter", message().errorMessage());
        assertEquals(DRIVER + ": Invalid parameter", run().lastError());
        assertEquals(Run.Status.WAITING, run().status(), "the run goes on with its next steps");

        f.metaFailure = null;
        new WhatsAppSendJob(f.whatsapp).handle(TENANT, f.sendJobs.get(0).payload());
        assertEquals(MessageStatus.SENT, message().status(), "manual job retry sends a formerly failed message");
    }

    @Test
    void attemptsRunOutTheMessageFailsAndTheRunRecordsIt() {
        f.metaFailure = new WhatsAppSendException("Service unavailable", 503, null);
        f.runSendJobs();
        f.park(f.sendJobs.get(0), "Service unavailable");
        assertEquals(MessageStatus.FAILED, message().status());
        assertEquals(DRIVER + ": Service unavailable", run().lastError());
    }

    @Test
    void anotherOrganizationsJobCannotSendTheMessage() {
        WhatsAppSendJob job = new WhatsAppSendJob(f.whatsapp);
        AsyncJobSpec spec = f.sendJobs.get(0);
        assertThrows(NonRetryableJobException.class, () -> job.handle("tenant-2", spec.payload()));
        f.parkAs("tenant-2", spec, "foreign job");
        assertEquals(MessageStatus.PENDING, message().status());
        assertNull(run().lastError());
    }
}
