package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
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
 * context kind, a fixed address as written, a path as the address in that field of the event's data. A role
 * nobody has, or a path without a value, gives no participant and a warning.
 */
public final class Audiences {

    private static final Logger LOG = Logger.getLogger(Audiences.class);

    /** The participants, without repeats, and the warnings for entries that gave none. */
    public record Resolved(List<Participant> participants, List<String> warnings) {
    }

    private final List<ParticipantResolver> resolvers;

    public Audiences(List<ParticipantResolver> resolvers) {
        this.resolvers = List.copyOf(resolvers);
    }

    public Resolved resolve(String tenantCode, String contextKind, String contextKey, List<Audience> entries,
            Map<String, Object> data) {
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
        String p = path.startsWith("event.data.") ? path.substring("event.data.".length())
                : path.startsWith("data.") ? path.substring("data.".length()) : path;
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
