package com.microboxlabs.miot.symptoms.events;

import com.microboxlabs.miot.core.event.EventTypeCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/** The symptom case events. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomEventCatalog implements EventTypeCatalog {

    public static final String EVENT_SOURCE = "miot-symptoms";
    public static final String CONTEXT_KIND = "symptom_case";
    public static final String OPENED = "symptom.case.opened";
    public static final String LEVEL_CHANGED = "symptom.case.level_changed";
    public static final String CLOSED = "symptom.case.closed";
    public static final String SLA_EXPIRED = "symptom.case.sla_expired";
    public static final String SIGNAL_RETURNED = "symptom.case.signal_returned";

    private static final List<EventType> TYPES = List.of(
            new EventType(OPENED, "A symptom case opened", SymptomCaseData.class),
            new EventType(LEVEL_CHANGED, "A symptom case changed level", SymptomCaseData.class),
            new EventType(CLOSED, "A symptom case closed, by its rules or by an operator", SymptomCaseData.class),
            new EventType(SLA_EXPIRED, "A symptom case was not attended within its level's SLA",
                    SymptomCaseData.class),
            new EventType(SIGNAL_RETURNED, "The signal of a lost-signal case's vehicle returned; the case stays open",
                    SymptomCaseData.class));

    @Override
    public String source() {
        return EVENT_SOURCE;
    }

    @Override
    public String contextKind() {
        return CONTEXT_KIND;
    }

    @Override
    public List<EventType> types() {
        return TYPES;
    }
}
