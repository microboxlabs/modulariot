package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.core.event.ContactConditions;
import com.microboxlabs.miot.core.event.ContactDirectory;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * {@link ContactConditions} with the communication rules' evaluator: the same {@code contact} map and CEL as a
 * "contacts from the book" audience, so a condition means the same in a rule and in an operator step.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class BookContactConditions implements ContactConditions {

    private final Function<String, List<ContactDirectory.Entry>> book;

    @Inject
    public BookContactConditions(Instance<ContactDirectory> directories) {
        this(tenant -> {
            List<ContactDirectory.Entry> out = new ArrayList<>();
            for (ContactDirectory d : directories) {
                out.addAll(d.active(tenant));
            }
            return out;
        });
    }

    BookContactConditions(Function<String, List<ContactDirectory.Entry>> book) {
        this.book = book;
    }

    @Override
    public Optional<String> problem(String condition) {
        return EventCondition.checkContact(condition).map(EventCondition.Issue::message);
    }

    @Override
    public List<List<String>> match(String tenantCode, List<String> conditions, Map<String, Object> data) {
        List<ContactDirectory.Entry> entries = book.apply(tenantCode);
        Map<String, Object> event = Map.of("data", data == null ? Map.of() : data);
        List<Map<String, Object>> vars = entries.stream().map(Audiences::contactVars).toList();
        List<List<String>> out = new ArrayList<>();
        for (String condition : conditions) {
            List<String> ids = new ArrayList<>();
            if (condition != null && !condition.isBlank() && EventCondition.checkContact(condition).isEmpty()) {
                for (int i = 0; i < entries.size(); i++) {
                    if (EventCondition.matchesContact(condition, event, vars.get(i))) {
                        ids.add(entries.get(i).id());
                    }
                }
            }
            out.add(List.copyOf(ids));
        }
        return out;
    }
}
