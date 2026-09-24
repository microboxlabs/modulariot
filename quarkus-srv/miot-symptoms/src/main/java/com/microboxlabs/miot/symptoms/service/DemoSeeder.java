package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Demo data for the Control Tower API while the data layer is being built:
 * a contact list per organization and a short, deterministic treatment history
 * per symptom the first time either is read. Everything it writes carries
 * {@code details.demo=true} or a {@code .example} address so it cannot be
 * mistaken for real activity. Off unless {@code miot.symptoms.control-tower.demo-seed=true}
 * (the default in the dev profile only).
 */
@ApplicationScoped
public class DemoSeeder {

    static final String DEMO_OPERATOR = "operador.demo@modulariot.example";
    private static final Map<String, Object> DEMO = Map.of("demo", true);

    private static final List<String> MESSAGES = List.of(
            "Se informó la condición detectada y se solicitó corregir la conducta.",
            "Se comunicó la alerta activa y se pidió mayor atención en la ruta.",
            "Se recordó el protocolo de descanso y se pidió detenerse en el próximo punto seguro.");
    private static final List<String> RESPONSES = List.of(
            "Confirma la recepción y se compromete a corregir.",
            "Indica que la condición ya fue corregida.",
            "Discute la alerta y no acepta responsabilidad.");

    private final boolean enabled;
    private final ContactStore contacts;
    private final TreatmentStore treatments;
    private final Set<String> seededTenants = new HashSet<>();
    private final Set<String> seededSymptoms = new HashSet<>();

    @Inject
    public DemoSeeder(
            @ConfigProperty(name = "miot.symptoms.control-tower.demo-seed", defaultValue = "false") boolean enabled,
            ContactStore contacts,
            TreatmentStore treatments) {
        this.enabled = enabled;
        this.contacts = contacts;
        this.treatments = treatments;
    }

    /** Seeds the organization's contact list once, if it has none. */
    public synchronized void ensureContacts(String tenantCode) {
        if (!enabled || !seededTenants.add(tenantCode) || !contacts.isEmpty(tenantCode)) {
            return;
        }
        contact(tenantCode, "Camila Espinoza", "Jefe de operaciones", "+56900000101",
                List.of(CallMethod.PHONE, CallMethod.TEAMS));
        contact(tenantCode, "Sebastián Muñoz", "Otro", "+56900000102",
                List.of(CallMethod.PHONE, CallMethod.WHATSAPP));
        contact(tenantCode, "Ignacio Rojas", "Transportista / Jefe de transporte", "+56900000103",
                List.of(CallMethod.PHONE, CallMethod.WHATSAPP, CallMethod.MEET));
        contact(tenantCode, "Valentina Reyes", "Jefe mina", "+56900000104", List.of(CallMethod.PHONE));
    }

    /**
     * Seeds zero to two closed episodes for a symptom the first time it is read.
     * The same tenant and symptom always produce the same history.
     */
    public synchronized void ensureHistory(String tenantCode, long symptomId) {
        if (!enabled || !seededSymptoms.add(tenantCode + ":" + symptomId)) {
            return;
        }
        ensureContacts(tenantCode);
        if (!treatments.listBySymptom(tenantCode, symptomId).isEmpty()) {
            return;
        }
        Random random = new Random(Objects.hash(tenantCode, symptomId));
        int episodes = random.nextInt(3);
        List<Contact> people = contacts.list(tenantCode, true);
        OffsetDateTime start = OffsetDateTime.now().minusMinutes(60L * (episodes + 1) + random.nextInt(50));
        for (int e = 0; e < episodes; e++) {
            OffsetDateTime openedAt = start.plusMinutes(75L * e);
            boolean endsIgnored = random.nextInt(3) == 0;
            int calls = 1 + random.nextInt(3);
            OffsetDateTime closedAt = openedAt.plusMinutes(4L * calls + 2);
            Treatment t = treatments.insert(new Treatment(null, tenantCode, symptomId, null, null,
                    TreatmentType.CALL, TreatmentStatus.CLOSED, DEMO_OPERATOR, openedAt, DEMO_OPERATOR, closedAt,
                    endsIgnored ? "ignored" : "resolved", null, closedAt));
            for (int c = 0; c < calls; c++) {
                addDemoCall(t, people, random, openedAt.plusMinutes(4L * c + 1));
            }
            if (endsIgnored) {
                treatments.addAction(new TreatmentAction(null, t.id(), tenantCode, 0, ActionKind.IGNORE, null,
                        null, null, null, null, "ignore_reason_2", "Zona de sombra GPS conocida", null, null,
                        null, null, List.of(), Map.of("demo", true, "durationSeconds", 1800), DEMO_OPERATOR,
                        closedAt));
            }
        }
    }

    private void addDemoCall(Treatment t, List<Contact> people, Random random, OffsetDateTime at) {
        int who = random.nextInt(people.size() + 1);
        Contact contact = who < people.size() ? people.get(who) : null;
        boolean answered = random.nextInt(5) != 0;
        int outcome = random.nextInt(3);
        String outcomeKey = answered
                ? List.of(TreatmentFormSelectables.RESULT_COMMITS, TreatmentFormSelectables.RESULT_CORRECTED,
                        TreatmentFormSelectables.RESULT_REJECTS).get(outcome)
                : TreatmentFormSelectables.RESULT_NO_ANSWER;
        String outcomeLabel = answered
                ? List.of("Contesta — se compromete a corregir", "Contesta — condición ya corregida",
                        "Contesta — rechaza o discute").get(outcome)
                : "No contesta";
        List<CallMethod> methods = contact == null || contact.methods().isEmpty()
                ? List.of(CallMethod.PHONE)
                : contact.methods();
        treatments.addAction(new TreatmentAction(null, t.id(), t.tenantCode(), 0, ActionKind.CALL,
                contact == null ? null : contact.id(),
                contact == null ? "Conductor del viaje" : contact.name(),
                contact == null ? "Conductor" : contact.role(),
                contact == null ? null : contact.phone(),
                methods.get(random.nextInt(methods.size())),
                outcomeKey, outcomeLabel, answered, answered ? 15 + random.nextInt(225) : 0,
                MESSAGES.get(random.nextInt(MESSAGES.size())),
                answered ? RESPONSES.get(outcome) : null,
                List.of(), DEMO, DEMO_OPERATOR, at));
    }

    private void contact(String tenantCode, String name, String role, String phone, List<CallMethod> methods) {
        contacts.insert(new Contact(null, tenantCode, name, role, phone, methods, true, "Contacto de demostración",
                "system:demo", null, null));
    }
}
