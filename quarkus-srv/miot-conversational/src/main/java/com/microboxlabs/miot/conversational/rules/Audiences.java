package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.core.event.ContactDirectory;
import com.microboxlabs.miot.core.event.Participant;
import com.microboxlabs.miot.core.event.ParticipantResolver;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jboss.logging.Logger;

/**
 * Turns audience entries into participants: a role through the {@link ParticipantResolver} for the event's
 * context kind, a fixed address as written, a path as the address in that field of the event's data, and a
 * contacts condition as the contact book's active contacts that meet it, on the step's channel. A role nobody
 * has, a path without a value, or a contact without an address on that channel gives a warning.
 */
public final class Audiences {

    private static final Logger LOG = Logger.getLogger(Audiences.class);

    /** The participants, without repeats, and the warnings for entries that gave none. */
    public record Resolved(List<Participant> participants, List<String> warnings) {
    }

    private final List<ParticipantResolver> resolvers;
    private final List<ContactDirectory> directories;

    public Audiences(List<ParticipantResolver> resolvers) {
        this(resolvers, List.of());
    }

    public Audiences(List<ParticipantResolver> resolvers, List<ContactDirectory> directories) {
        this.resolvers = List.copyOf(resolvers);
        this.directories = List.copyOf(directories);
    }

    public Resolved resolve(String tenantCode, String contextKind, String contextKey, List<Audience> entries,
            Map<String, Object> data) {
        return resolve(tenantCode, contextKind, contextKey, entries, data, null, Map.of("data", data));
    }

    /**
     * @param channel the step's channel, which picks a contact's address: {@code email} their email, {@code
     *                whatsapp} their WhatsApp, else WhatsApp when they have it and email when not
     * @param event   the event as rules' conditions read it
     */
    public Resolved resolve(String tenantCode, String contextKind, String contextKey, List<Audience> entries,
            Map<String, Object> data, String channel, Map<String, Object> event) {
        Map<String, Participant> out = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();
        for (Audience a : entries) {
            if (a.role() != null) {
                List<Participant> found = role(tenantCode, contextKind, contextKey, a.role(), data);
                if (found.isEmpty()) {
                    warnings.add("Nadie tiene el rol " + a.role());
                }
                found.forEach(p -> out.putIfAbsent(p.channel() + ":" + p.address(), p));
            } else if (a.address() != null) {
                Participant p = new Participant(a.address(), channel(a.channel(), a.address()), a.name(), null, null);
                out.putIfAbsent(p.channel() + ":" + p.address(), p);
            } else if (a.contacts() != null) {
                contacts(tenantCode, a.contacts(), channel, event, out, warnings);
            } else if (a.path() != null) {
                Object value = path(data, a.path());
                if (value == null || String.valueOf(value).isBlank()) {
                    warnings.add("El campo " + a.path() + " no tiene dirección");
                } else {
                    String address = String.valueOf(value).trim();
                    Participant p = new Participant(address, channel(a.channel(), address), a.name(), null, null);
                    out.putIfAbsent(p.channel() + ":" + p.address(), p);
                }
            }
        }
        return new Resolved(List.copyOf(out.values()), warnings);
    }

    private void contacts(String tenantCode, String when, String channel, Map<String, Object> event,
            Map<String, Participant> out, List<String> warnings) {
        int matched = 0;
        for (ContactDirectory.Entry c : book(tenantCode)) {
            if (EventCondition.matchesContact(when, event, contactVars(c))) {
                matched++;
                addContact(c, channel, out, warnings);
            }
        }
        if (matched == 0) {
            warnings.add("Ningún contacto de la libreta cumple la condición");
        }
    }

    private static void addContact(ContactDirectory.Entry c, String channel, Map<String, Participant> out,
            List<String> warnings) {
        String ch = contactChannel(channel, c);
        String address = RuleSpec.EMAIL.equals(ch) ? c.email() : c.whatsapp();
        if (address == null || address.isBlank()) {
            warnings.add(c.name() + (RuleSpec.EMAIL.equals(ch) ? " no tiene correo" : " no tiene WhatsApp"));
        } else {
            Participant p = new Participant(address, ch, c.name(), c.id(), c.role());
            out.putIfAbsent(p.channel() + ":" + p.address(), p);
        }
    }

    private List<ContactDirectory.Entry> book(String tenantCode) {
        if (directories.isEmpty()) {
            throw new IllegalStateException("Contact book is unavailable");
        }
        List<ContactDirectory.Entry> out = new ArrayList<>();
        for (ContactDirectory d : directories) {
            out.addAll(d.active(tenantCode));
        }
        return out;
    }

    /** The contact as {@code contact} in a condition; a missing text is empty and missing tags an empty list. */
    static Map<String, Object> contactVars(ContactDirectory.Entry c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", text(c.id()));
        m.put("name", text(c.name()));
        m.put("role", text(c.role()));
        m.put("tags", c.tags() == null ? List.of() : c.tags());
        m.put("company", text(c.company()));
        m.put("companyRut", text(c.companyRut()));
        m.put("position", text(c.position()));
        m.put("member", c.member());
        m.put("email", text(c.email()));
        m.put("whatsapp", text(c.whatsapp()));
        return m;
    }

    private static String text(String s) {
        return s == null ? "" : s;
    }

    private static String contactChannel(String channel, ContactDirectory.Entry c) {
        if (RuleSpec.EMAIL.equals(channel) || RuleSpec.WHATSAPP.equals(channel)) {
            return channel;
        }
        return c.whatsapp() != null && !c.whatsapp().isBlank() ? RuleSpec.WHATSAPP : RuleSpec.EMAIL;
    }

    /** The roles known for a context kind; empty when no resolver supports it. */
    public Optional<List<String>> roles(String tenantCode, String contextKind) {
        List<String> roles = new ArrayList<>();
        boolean supported = false;
        for (ParticipantResolver r : resolvers) {
            if (r.supports(contextKind)) {
                supported = true;
                try {
                    roles.addAll(r.roles(tenantCode, contextKind));
                } catch (RuntimeException e) {
                    LOG.debugf("Roles for %s unavailable (%s)", contextKind, e.getClass().getSimpleName());
                }
            }
        }
        return supported ? Optional.of(roles) : Optional.empty();
    }

    private List<Participant> role(String tenantCode, String contextKind, String contextKey, String role,
            Map<String, Object> data) {
        List<Participant> out = new ArrayList<>();
        for (ParticipantResolver r : resolvers) {
            if (contextKind != null && r.supports(contextKind)) {
                try {
                    out.addAll(r.resolve(tenantCode, contextKind, contextKey, role, data));
                } catch (RuntimeException e) {
                    LOG.warnf("Role %s for %s %s not resolved (%s)", role, contextKind, contextKey,
                            e.getClass().getSimpleName());
                }
            }
        }
        return out;
    }

    /** The given channel, else email for an address with {@code @}, else WhatsApp. */
    static String channel(String channel, String address) {
        if (channel != null) {
            return channel;
        }
        return address.contains("@") ? RuleSpec.EMAIL : RuleSpec.WHATSAPP;
    }

    /** A field of the data by dotted path; a leading {@code event.data.} or {@code data.} is ignored. */
    @SuppressWarnings("unchecked")
    static Object path(Map<String, Object> data, String path) {
        String p = path;
        for (String prefix : List.of("event.data.", "data.")) {
            if (p.startsWith(prefix)) {
                p = p.substring(prefix.length());
                break;
            }
        }
        Object current = data;
        for (String part : p.split("\\.")) {
            if (!(current instanceof Map<?, ?> m)) {
                return null;
            }
            current = ((Map<String, Object>) m).get(part);
        }
        return current;
    }
}
