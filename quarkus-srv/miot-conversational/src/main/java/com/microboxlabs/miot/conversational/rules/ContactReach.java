package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.EventCondition.Reach;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import com.microboxlabs.miot.conversational.rules.store.RuleStore;
import com.microboxlabs.miot.core.event.ContactDirectory;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/**
 * Which rules in force write to each contact of the book through a "Desde la libreta" audience. A condition that
 * reads the event gives {@code always = false}: the contact gets the message only for some events.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ContactReach {

    private static final Logger LOG = Logger.getLogger(ContactReach.class);

    public record Reached(String ruleId, String name, Rule.State state, boolean always) {
    }

    private final RuleStore rules;
    private final Supplier<List<ContactDirectory>> directories;

    @Inject
    ContactReach(RuleStore rules, Instance<ContactDirectory> directories) {
        this(rules, () -> directories.stream().toList());
    }

    public ContactReach(RuleStore rules, Supplier<List<ContactDirectory>> directories) {
        this.rules = rules;
        this.directories = directories;
    }

    /** Contact id to the rules that reach it, in rule order; contacts no rule reaches are left out. */
    public Map<String, List<Reached>> byContact(String tenantCode) {
        List<ContactDirectory.Entry> book = book(tenantCode);
        Map<String, List<Reached>> out = new LinkedHashMap<>();
        for (RuleStore.InForce f : rules.inForce(tenantCode)) {
            List<Condition> conditions = conditions(RuleSpec.read(f.version().spec()));
            if (conditions.isEmpty()) {
                continue;
            }
            for (ContactDirectory.Entry c : book) {
                Reach reach = reach(conditions, c);
                if (reach != Reach.NO) {
                    out.computeIfAbsent(c.id(), k -> new ArrayList<>()).add(
                            new Reached(f.rule().id(), f.rule().name(), f.rule().state(), reach == Reach.YES));
                }
            }
        }
        return out;
    }

    /** YES when any condition always takes the contact, else DEPENDS when one may, else NO. */
    static Reach reach(List<Condition> conditions, ContactDirectory.Entry contact) {
        Reach best = Reach.NO;
        for (Condition condition : conditions) {
            if (!hasAddress(contact, condition.channel())) {
                continue;
            }
            Reach r = EventCondition.reachContact(condition.when(), Audiences.contactVars(contact));
            if (r == Reach.YES) {
                return r;
            }
            if (r == Reach.DEPENDS) {
                best = r;
            }
        }
        return best;
    }

    record Condition(String when, String channel) {
    }

    private static boolean hasAddress(ContactDirectory.Entry contact, String channel) {
        if (RuleSpec.EMAIL.equals(channel)) {
            return contact.email() != null && !contact.email().isBlank();
        }
        if (RuleSpec.WHATSAPP.equals(channel)) {
            return contact.whatsapp() != null && !contact.whatsapp().isBlank();
        }
        return (contact.email() != null && !contact.email().isBlank())
                || (contact.whatsapp() != null && !contact.whatsapp().isBlank());
    }

    /** Only contact conditions in audiences actually used by messaging steps. */
    static List<Condition> conditions(RuleSpec spec) {
        List<Condition> out = new ArrayList<>();
        for (Step s : spec.steps()) {
            if (!s.viaConnection()) {
                addContacts(spec.recipients(s), s.channel(), out);
            }
        }
        return out;
    }

    private static void addContacts(List<Audience> entries, String channel, List<Condition> out) {
        if (entries == null) {
            return;
        }
        for (Audience a : entries) {
            Condition condition = new Condition(a.contacts(), channel);
            if (a.contacts() != null && !a.contacts().isBlank() && !out.contains(condition)) {
                out.add(condition);
            }
        }
    }

    private List<ContactDirectory.Entry> book(String tenantCode) {
        List<ContactDirectory.Entry> out = new ArrayList<>();
        for (ContactDirectory d : directories.get()) {
            try {
                out.addAll(d.active(tenantCode));
            } catch (RuntimeException e) {
                LOG.warnf("Contact book for %s unavailable (%s)", tenantCode, e.getClass().getSimpleName());
            }
        }
        return out;
    }
}
