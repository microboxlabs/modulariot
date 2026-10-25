package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.microboxlabs.miot.conversational.accounts.InMemoryChannelAccounts;
import com.microboxlabs.miot.conversational.client.MetaWhatsAppClient;
import com.microboxlabs.miot.conversational.jobs.EmailSendJob;
import com.microboxlabs.miot.conversational.jobs.SendJobsOnPark;
import com.microboxlabs.miot.conversational.jobs.WhatsAppSendJob;
import com.microboxlabs.miot.conversational.service.ConnectionMessagingService;
import com.microboxlabs.miot.conversational.service.EmailMessagingService;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.EventTypeCatalog;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.integrations.email.EmailMessage;
import com.microboxlabs.miot.integrations.email.ResendEmailSender;
import com.microboxlabs.miot.integrations.email.SendResult;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * The rules engine and service over in-memory stores, a fake Meta client, a fake Resend sender and a settable
 * clock. Placeholder phones and example.com addresses only.
 */
final class RulesFixture {

    static final String TENANT = "tenant-1";
    static final String DRIVER = "+56900000001";
    static final String LEAD = "+56900000002";
    static final Instant T0 = Instant.parse("2026-10-23T15:04:00Z");
    static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    /** A payload like the symptom case's. */
    @Schema(title = "Caso de prueba")
    record CaseData(
            @Schema(title = "Clave del síntoma", description = "The symptom's key") String symptomKey,
            @Schema(title = "Síntoma (nombre)") String symptomName,
            @Schema(title = "Nivel") int level,
            @Schema(title = "Vehículo") String assetId,
            Double latitude,
            Double longitude,
            Instant levelSince,
            boolean urgent) {
    }

    record Sent(String to, String template, String language, Map<String, String> params) {
    }

    final InMemoryRules store = new InMemoryRules();
    final List<Sent> whatsappSent = new ArrayList<>();
    final List<EmailMessage> emailsSent = new ArrayList<>();
    final List<String> emailTenants = new ArrayList<>();
    final Map<String, Object> connectionMetadata = new LinkedHashMap<>(Map.of("phone_number_id", "PNID"));
    Instant now = T0;
    /** Thrown by the fake Meta client instead of sending, when set. */
    RuntimeException metaFailure;
    final Clock clock = new Clock() {
        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    };

    final ParticipantResolver participants = new ParticipantResolver() {
        @Override
        public boolean supports(String contextKind) {
            return "symptom_case".equals(contextKind);
        }

        @Override
        public List<String> roles(String tenantCode, String contextKind) {
            return List.of("driver", "Jefe de torre");
        }

        @Override
        public List<Participant> resolve(String tenantCode, String contextKind, String contextKey, String role,
                Map<String, Object> eventData) {
            return switch (role) {
                case "driver" -> List.of(new Participant(DRIVER, "whatsapp", "Ana", null, "driver"));
                case "Jefe de torre" -> List.of(new Participant(LEAD, "whatsapp", "Luis", "c-1", "Jefe de torre"));
                default -> List.of();
            };
        }
    };

    final EventTypeCatalog catalog = new EventTypeCatalog() {
        @Override
        public String source() {
            return "miot-symptoms";
        }

        @Override
        public String contextKind() {
            return "symptom_case";
        }

        @Override
        public List<EventType> types() {
            return List.of(new EventType("symptom.case.opened", "A symptom case opened", CaseData.class),
                    new EventType("symptom.case.closed", "A symptom case closed", CaseData.class));
        }
    };

    /** The tenant sends email from its own RESEND connection and WhatsApp from the platform's account. */
    final InMemoryChannelAccounts accounts = new InMemoryChannelAccounts()
            .connect(TENANT, ProviderType.RESEND).own(TENANT, "email");

    final WhatsAppMessagingService whatsapp = new WhatsAppMessagingService(new IntegrationConnectionResolver(null,
            null, null) {
        @Override
        public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
            return new ResolvedConnection("conn-1", URI.create("https://graph.example.test"), connectionMetadata,
                    Map.of("token", "test-token"));
        }
    }, new MetaWhatsAppClient() {
        @Override
        public String sendTemplate(URI baseUrl, String phoneNumberId, String token, String toE164,
                String templateName, String languageCode, Map<String, String> namedParams) {
            if (metaFailure != null) {
                throw metaFailure;
            }
            whatsappSent.add(new Sent(toE164, templateName, languageCode, namedParams));
            return "wamid.out-" + whatsappSent.size();
        }
    }, store.conversations.conversationRepository, store.conversations.messageRepository, accounts.service);

    final EmailMessagingService email = new EmailMessagingService(new ResendEmailSender(null, null, null) {
        @Override
        public boolean configured(String tenantCode) {
            return TENANT.equals(tenantCode);
        }

        @Override
        public SendResult send(String tenantCode, EmailMessage message, String idempotencyKey) {
            emailTenants.add(tenantCode);
            emailsSent.add(message);
            return SendResult.accepted(200, "email-" + emailsSent.size());
        }
    }, store.conversations.conversationRepository, store.conversations.messageRepository, accounts.service);

    final InMemoryIntegrations integrations = new InMemoryIntegrations();

    /** The send jobs the engine enqueued, in order, and what each run of one gave. */
    final List<AsyncJobSpec> sendJobs = new ArrayList<>();
    final List<Object> sendOutcomes = new ArrayList<>();
    /** When set, enqueued send jobs wait for {@link #runSendJobs()} instead of running right away. */
    boolean holdSends;
    private final WhatsAppSendJob whatsappJob = new WhatsAppSendJob(whatsapp);
    private final EmailSendJob emailJob = new EmailSendJob(email);
    private final List<AsyncJobSpec> held = new ArrayList<>();
    final SendQueue sendQueue = (tenant, specs) -> {
        sendJobs.addAll(specs);
        held.addAll(specs);
        if (!holdSends) {
            runSendJobs();
        }
    };

    /**
     * Runs the held send jobs once, as the worker would: a retryable failure stays held for the next run, one a
     * retry cannot fix parks the job. Each outcome or thrown failure is kept.
     */
    void runSendJobs() {
        List<AsyncJobSpec> due = new ArrayList<>(held);
        held.clear();
        for (AsyncJobSpec spec : due) {
            ModulithJobHandler handler = InternalJobTypes.WHATSAPP_SEND.equals(spec.jobType()) ? whatsappJob
                    : emailJob;
            try {
                sendOutcomes.add(handler.handle(TENANT, spec.payload()));
            } catch (NonRetryableJobException e) {
                sendOutcomes.add(e);
                park(spec, e.getMessage());
            } catch (RuntimeException e) {
                sendOutcomes.add(e);
                held.add(spec);
            }
        }
    }

    /** The ledger giving up on a send job, with its last error. */
    void park(AsyncJobSpec spec, String lastError) {
        parkAs(TENANT, spec, lastError);
    }

    void parkAs(String tenant, AsyncJobSpec spec, String lastError) {
        held.remove(spec);
        new SendJobsOnPark(store.runStore).parked(new AsyncJob(
                UUID.randomUUID().toString(), tenant, "test", spec.executor(), spec.jobType(), spec.correlationKey(),
                null, 0, spec.dedupeKey(), spec.payload(), JobState.FAILED, 5, 5, null, null, null, lastError,
                List.of(), "listener", null, null, null));
    }

    final RulesEngine engine = new RulesEngine(true,
            new RulesEngine.Stores(store.ruleStore, store.templateStore, store.runStore), () -> List.of(participants),
            new RulesEngine.Senders(whatsapp, email, integrations.channels,
                    new ConnectionMessagingService(store.conversations.conversationRepository,
                            store.conversations.messageRepository), sendQueue), JSON, clock);

    final RulesService service = new RulesService(store.ruleStore, store.templateStore, () -> List.of(catalog),
            () -> List.of(participants), clock);
    final RuleSimulator simulator = new RuleSimulator(service, store.templateStore, () -> List.of(participants),
            clock);
    final TemplatesService templates = new TemplatesService(store.ruleStore, store.templateStore, clock);
    final RunsService runs = new RunsService(store.runStore);
    final RuleInvocations invocations = new RuleInvocations(service, engine, clock);

    RulesFixture() {
        templates.save("panic-check", new TemplatesService.TemplateRequest("Botón de pánico · conductor",
                "Hola {{nombre}}, se activó el botón de pánico en {{patente}} a las {{hora}}. ¿Estás bien?",
                new ConvTemplate.WhatsApp("miot_panic_check_v1", "es_CL", List.of("nombre", "patente", "hora")),
                null), "owner@example.com");
        templates.save("panic-tower", new TemplatesService.TemplateRequest("Botón de pánico · torre",
                "Sin respuesta de {{nombre}}", null,
                new ConvTemplate.Email("Pánico en {{patente}} ({{nivel}})",
                        "El conductor no respondió. Ubicación: {{ubicacion}}.")), "owner@example.com");
    }

    static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalArgumentException(e);
        }
    }

    /** The slice's panic rule: WhatsApp to the audience, wait 5, then email to the tower, wait 10. */
    static final String PANIC_SPEC = """
            {
              "trigger": {"event": "symptom.case.opened",
                          "when": "event.data.symptomKey == 'panic-button' && event.data.level >= 4"},
              "audience": [{"role": "driver"}],
              "steps": [
                {"after": 0, "channel": "whatsapp", "template": "panic-check", "to": "audience",
                 "waitForReply": 5, "onReply": "stop"},
                {"after": 0, "channel": "email", "template": "panic-tower",
                 "to": [{"address": "tower@example.com", "channel": "email", "name": "Jefe de torre"}],
                 "waitForReply": 10, "onReply": "stop"}
              ]
            }
            """;

    /** Creates, publishes and switches a rule. */
    Rule rule(String key, String spec, Rule.State state) {
        RulesService.RuleDetail created = service.create(TENANT, key, "Regla " + key, json(spec), "owner@example.com");
        service.publish(TENANT, created.rule().id(), "first", null, "owner@example.com");
        return service.setState(TENANT, created.rule().id(), state);
    }

    static CaseData panic(int level) {
        return new CaseData("panic-button", "Botón de pánico", level, "ABCD12", -33.456789, -70.648271, null, true);
    }

    static OperationalEvent event(String type, String caseKey, Object data, boolean test) {
        return new OperationalEvent(type, "miot-symptoms", TENANT, T0, new EventContext("symptom_case", caseKey),
                data, test);
    }

    static String id() {
        return UUID.randomUUID().toString();
    }
}
