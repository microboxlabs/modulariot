package com.microboxlabs.miot.conversational.calling;

import java.util.UUID;
import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.Limit;
import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.Refusal;
import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.State;
import io.quarkus.arc.properties.IfBuildProperty;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.client.WhatsAppSendException;
import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService.SendingNumber;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * WhatsApp call permissions: what each contact allowed each business number, and the requests that ask for it.
 * A request is refused, never thrown, when calling is off, the contact already allows calls, or Meta's limits
 * (1 per 24 hours, 2 per 7 days per number and contact) would be broken. Replies and call events from the
 * webhook update the permission whatever the flag says.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class CallPermissionService {

    /** The platform template that carries the request. */
    public static final String TEMPLATE_KEY = "miot_call_permission_request";
    public static final String ORIGIN_RULE = "rule";
    public static final String ORIGIN_MANUAL = "manual";
    static final String DEFAULT_LANGUAGE = "es";
    static final String DEFAULT_NAME = "conductor";
    static final String EMPTY_PARAM = "-";
    private static final Logger LOG = Logger.getLogger(CallPermissionService.class);

    /** The sending number of a tenant's WhatsApp messages; {@code to} is checked against test mode when set. */
    @FunctionalInterface
    public interface Numbers {
        SendingNumber resolve(String tenantCode, String to);
    }

    /** Sends a Meta template; returns its wamid. */
    @FunctionalInterface
    public interface Sender {
        String send(String tenantCode, SendingNumber number, String to, String metaName, String language, Map<String, String> params);
    }

    /**
     * What the app shows for a contact. {@code refusal} says why {@code canRequest} is false.
     */
    public record View(boolean callingEnabled, State state, CallPermissionStatus permission, Instant expiresAt,
            Instant lastRequestAt, boolean canRequest, Refusal refusal, Instant nextRequestAt) {
    }

    /** The outcome of a request: sent, or refused with the reason. */
    public record RequestResult(boolean sent, Refusal refusal, String detail, Instant nextRequestAt, View view) {
    }

    /** Whether a request to {@code contactE164} may be sent from {@code number}; {@code refusal} is null if so. */
    public record Admission(SendingNumber number, String contactE164, Refusal refusal, String detail,
            Instant nextRequestAt) {

        public boolean admitted() {
            return refusal == null;
        }

        static Admission refused(Refusal refusal, String detail) {
            return new Admission(null, null, refusal, detail, null);
        }
    }

    private final CallPermissionStore store;
    private final Function<String, Optional<ConvTemplate>> templates;
    private final Numbers numbers;
    private final Sender sender;
    private final boolean enabled;
    private final Clock clock;

    @Inject
    public CallPermissionService(CallPermissionStore store, TemplateStore templates,
            WhatsAppMessagingService whatsapp,
            @ConfigProperty(name = "miot.conversational.whatsapp-calling.enabled", defaultValue = "false")
            boolean enabled) {
        this(store, key -> templates.find(ConvTemplate.PLATFORM_TENANT, key), whatsapp::sendingNumber,
                whatsapp::sendCallPermission,
                enabled, Clock.systemUTC());
    }

    public CallPermissionService(CallPermissionStore store, Function<String, Optional<ConvTemplate>> templates,
            Numbers numbers, Sender sender, boolean enabled, Clock clock) {
        this.store = store;
        this.templates = templates;
        this.numbers = numbers;
        this.sender = sender;
        this.enabled = enabled;
        this.clock = clock;
    }

    public boolean enabled() {
        return enabled;
    }

    /** The permission of {@code phone} on the organization's sending number. */
    public View view(String tenantCode, String phone) {
        String contact = e164(phone);
        if (contact == null) {
            return blocked(Refusal.INVALID_PHONE);
        }
        SendingNumber number;
        try {
            number = numbers.resolve(tenantCode, contact);
        } catch (ConnectionResolutionException | IllegalArgumentException e) {
            return blocked(Refusal.NO_CONNECTION);
        }
        return view(number.phoneNumberId(), contact, clock.instant());
    }

    /** Checks the flag, the permission and the limits for a request to {@code phone}. Sends nothing. */
    public Admission admit(String tenantCode, String phone) {
        if (!enabled) {
            return Admission.refused(Refusal.CALLING_DISABLED, "WhatsApp calling is off");
        }
        String contact = e164(phone);
        if (contact == null) {
            return Admission.refused(Refusal.INVALID_PHONE, "Not a phone number");
        }
        SendingNumber number;
        try {
            number = numbers.resolve(tenantCode, contact);
        } catch (ConnectionResolutionException | IllegalArgumentException e) {
            return Admission.refused(Refusal.NO_CONNECTION, e.getMessage());
        }
        Instant now = clock.instant();
        CallPermission permission = permission(number.phoneNumberId(), contact);
        if (permission.active(now)) {
            return new Admission(number, contact, Refusal.ALREADY_GRANTED, "The contact already allows calls",
                    null);
        }
        Optional<Limit> limit = limit(number.phoneNumberId(), contact, permission, now);
        if (limit.isPresent()) {
            return new Admission(number, contact, limit.get().reason(),
                    "Meta allows 1 request per 24 hours and 2 per 7 days", limit.get().nextAllowedAt());
        }
        return new Admission(number, contact, null, null, null);
    }

    /** Sends the request template to {@code phone} now, when the limits allow it. */
    public RequestResult request(String tenantCode, String phone, String recipientName, String actor) {
        // Commit admission before the external side effect. An unknown send outcome or a failed
        // receipt write must still consume the slot, including after a process/replica restart.
        Prepared prepared = withAdmission(tenantCode, phone, admission -> prepareRequest(tenantCode, actor, admission));
        if (!prepared.admission().admitted()) return refused(prepared.admission());
        Admission admission = prepared.admission();
        String wamid;
        try {
            ConvTemplate.WhatsApp template = prepared.template();
            wamid = sender.send(tenantCode, admission.number(), admission.contactE164(), template.metaName(),
                    template.language() == null ? DEFAULT_LANGUAGE : template.language(),
                    params(template.params(), recipientName));
        } catch (ConnectionResolutionException e) {
            store.cancelRequest(prepared.id()); // Resolution failed before Meta was called.
            return refused(Admission.refused(Refusal.NO_CONNECTION, e.getMessage()));
        } catch (WhatsAppSendException e) {
            // A definitive client rejection did not send. Timeouts/unknown/server outcomes retain
            // the committed admission: retrying those could send a duplicate request.
            Integer status = e.httpStatus();
            if (status != null && status >= 400 && status < 500 && status != 408) {
                store.cancelRequest(prepared.id());
            }
            LOG.warnf("Call permission request for tenant %s failed: %s", tenantCode, e.getMessage());
            return refused(Admission.refused(Refusal.SEND_FAILED, e.getMessage()));
        }
        Instant now = clock.instant();
        store.completeRequest(prepared.id(), wamid, now);
        return new RequestResult(true, null, wamid, null,
                view(admission.number().phoneNumberId(), admission.contactE164(), now));
    }

    /** Admission is rechecked under the same number/contact transaction lock used by sends and events. */
    public <T> T withAdmission(String tenantCode, String phone, Function<Admission, T> work) {
        Admission initial = admit(tenantCode, phone);
        if (!initial.admitted()) return work.apply(initial);
        return store.locked(initial.number().phoneNumberId(), initial.contactE164(), () -> {
            Admission current = admit(tenantCode, phone);
            if (current.admitted() && (!current.number().phoneNumberId().equals(initial.number().phoneNumberId())
                    || !current.number().tenantCode().equals(initial.number().tenantCode()))) {
                current = Admission.refused(Refusal.NO_CONNECTION, "The sending number changed; retry");
            }
            return work.apply(current);
        });
    }

    private record Prepared(Admission admission, ConvTemplate.WhatsApp template, UUID id) { }

    private Prepared prepareRequest(String tenantCode, String actor, Admission admission) {
        if (!admission.admitted()) return new Prepared(admission, null, null);
        Optional<ConvTemplate.WhatsApp> template = templates.apply(TEMPLATE_KEY).map(ConvTemplate::whatsapp)
                .filter(w -> w.metaName() != null && !w.metaName().isBlank());
        if (template.isEmpty()) {
            return new Prepared(Admission.refused(Refusal.NO_TEMPLATE, "No template " + TEMPLATE_KEY), null, null);
        }
        UUID id = UUID.randomUUID();
        store.reserveRequest(id, tenantCode, admission.number().phoneNumberId(), admission.contactE164(), actor,
                clock.instant());
        return new Prepared(admission, template.get(), id);
    }

    /** Records a request a rule sent through an admitted {@link Admission}. */
    public void recordSent(String tenantCode, Admission admission, String wamid) {
        store.recordRequest(tenantCode, admission.number().phoneNumberId(), admission.contactE164(), ORIGIN_RULE,
                wamid, null, clock.instant());
    }

    /** Recover an already-sent rule message using its original sender and send time. */
    public void recordSent(String tenantCode, Message message) {
        if (message.providerMessageId() == null || message.sentAt() == null) return;
        Object number = message.metadata() == null ? null : message.metadata().get("phoneNumberId");
        if (number == null) throw new IllegalStateException("Sent permission request lacks its original business number");
        String contact = e164(message.address());
        store.locked(number.toString(), contact, () -> {
            store.recordRequest(tenantCode, number.toString(), contact, ORIGIN_RULE,
                    message.providerMessageId(), null, message.sentAt().toInstant());
            return true;
        });
    }

    public void applyReply(CallPermissionReply reply) {
        if (reply.phoneNumberId() == null || reply.contactE164() == null || reply.wamid() == null
                || reply.timestamp() == null) return;
        applyEvent(PermissionEvent.reply(reply, clock.instant()));
    }

    public void applyCall(CallEvent call) {
        if (call.phoneNumberId() == null || call.contactE164() == null || call.callId() == null
                || call.timestamp() == null || !call.terminated()) return;
        applyEvent(PermissionEvent.call(call, clock.instant()));
    }

    private void applyEvent(PermissionEvent event) {
        store.locked(event.number(), event.contact(), () -> {
            CallPermission state = store.checkpoint(event.number(), event.contact());
            store.recordEvent(event);
            var ordered = store.events(event.number(), event.contact()).stream()
                    .sorted(java.util.Comparator.comparing(PermissionEvent::occurredAt)
                            .thenComparingInt(PermissionEvent::order).thenComparing(PermissionEvent::id)).toList();
            for (PermissionEvent recorded : ordered) state = recorded.apply(state);
            store.save(state);
            return true;
        });
    }

    private View view(String numberId, String contact, Instant now) {
        CallPermission permission = permission(numberId, contact);
        List<Instant> sent = store.requestsSince(numberId, contact, now.minus(CallPermissionPolicy.WEEK));
        Instant last = sent.isEmpty() ? null : sent.get(sent.size() - 1);
        State state = CallPermissionPolicy.state(permission, last, now);
        Refusal refusal = null;
        Instant next = null;
        if (!enabled) {
            refusal = Refusal.CALLING_DISABLED;
        } else if (permission.active(now)) {
            refusal = Refusal.ALREADY_GRANTED;
        } else {
            Optional<Limit> limit = CallPermissionPolicy.limit(sent, permission.lastConnectedCallAt(), now);
            if (limit.isPresent()) {
                refusal = limit.get().reason();
                next = limit.get().nextAllowedAt();
            }
        }
        return new View(enabled, state, permission.status(), permission.expiresAt(), last, refusal == null,
                refusal, next);
    }

    private View blocked(Refusal refusal) {
        return new View(enabled, State.NO_PERMISSION, CallPermissionStatus.NONE, null, null, false,
                enabled ? refusal : Refusal.CALLING_DISABLED, null);
    }

    private RequestResult refused(Admission admission) {
        View view = admission.number() == null ? blocked(admission.refusal())
                : view(admission.number().phoneNumberId(), admission.contactE164(), clock.instant());
        return new RequestResult(false, admission.refusal(), admission.detail(), admission.nextRequestAt(), view);
    }

    private Optional<Limit> limit(String numberId, String contact, CallPermission permission, Instant now) {
        return CallPermissionPolicy.limit(store.requestsSince(numberId, contact, now.minus(CallPermissionPolicy.WEEK)),
                permission.lastConnectedCallAt(), now);
    }

    private CallPermission permission(String numberId, String contact) {
        return store.find(numberId, contact).orElse(CallPermission.none(numberId, contact));
    }

    /** The template's NAMED parameters: {@code nombre} is the recipient, any other is "-". */
    static Map<String, String> params(List<String> names, String recipientName) {
        String recipient = recipientName == null || recipientName.isBlank() ? DEFAULT_NAME : recipientName.trim();
        Map<String, String> out = new LinkedHashMap<>();
        for (String name : names) {
            out.put(name, "nombre".equals(name) ? recipient : EMPTY_PARAM);
        }
        return out;
    }

    /** {@code +} and 8 to 15 digits, or null. */
    static String e164(String phone) {
        if (phone == null) {
            return null;
        }
        String digits = phone.replaceAll("\\D", "");
        return digits.length() >= 8 && digits.length() <= 15 ? "+" + digits : null;
    }
}
