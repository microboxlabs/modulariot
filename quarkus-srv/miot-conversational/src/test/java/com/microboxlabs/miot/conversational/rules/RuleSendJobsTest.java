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
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.jobs.WhatsAppSendJob;
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
        assertEquals(1, f.whatsappSent.size());
        assertEquals(MessageStatus.SENT, message().status());
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
        assertEquals(MessageStatus.PENDING, message().status());
    }
}
