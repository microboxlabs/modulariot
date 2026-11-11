package com.microboxlabs.miot.core.iam;

import java.text.Normalizer;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

/**
 * What a custom role may be and who may change it. No I/O. A refusal is an {@link IllegalArgumentException} (400)
 * for a bad request or a {@link SecurityException} (403) for a change the actor may not make.
 */
public final class CustomRoleRules {

    static final int MAX_NAME = 80;
    static final int MAX_DESCRIPTION = 500;
    /** Leaves room for the prefix and a numeric suffix inside {@code role_key VARCHAR(96)}. */
    static final int MAX_SLUG = 64;

    private CustomRoleRules() {
    }

    /** Only an Owner or Admin of the organization creates, edits or deletes custom roles. */
    public static void checkManage(Access actor) {
        if (!actor.member() || !actor.baseRole().atLeast(BaseRole.ADMIN)) {
            throw new SecurityException("Only an owner or admin manages custom roles");
        }
    }

    public static String name(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        String name = value.trim();
        if (name.length() > MAX_NAME) {
            throw new IllegalArgumentException(field + " is at most " + MAX_NAME + " characters");
        }
        return name;
    }

    /** Trimmed, null when blank. */
    public static String description(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        if (text.length() > MAX_DESCRIPTION) {
            throw new IllegalArgumentException(field + " is at most " + MAX_DESCRIPTION + " characters");
        }
        return text;
    }

    /** Lower-case letters and digits joined by single hyphens, without accents; {@code role} when nothing is left. */
    public static String slug(String name) {
        String ascii = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        StringBuilder out = new StringBuilder();
        for (char c : ascii.toCharArray()) {
            if (out.length() >= MAX_SLUG) {
                break;
            }
            boolean keep = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
            if (keep) {
                out.append(c);
            } else if (!out.isEmpty() && out.charAt(out.length() - 1) != '-') {
                out.append('-');
            }
        }
        while (!out.isEmpty() && out.charAt(out.length() - 1) == '-') {
            out.setLength(out.length() - 1);
        }
        return out.isEmpty() ? "role" : out.toString();
    }

    /** {@code custom:<slug>}, with {@code -2}, {@code -3}… when the organization already uses the key. */
    public static String key(String name, Collection<String> taken) {
        String base = OrgRoles.CUSTOM_PREFIX + slug(name);
        String key = base;
        for (int n = 2; taken.contains(key); n++) {
            key = base + "-" + n;
        }
        return key;
    }

    /** The requested permission keys: at least one, each declared in the access catalog. */
    public static Set<String> permissions(Collection<String> requested, AccessRegistry registry) {
        Set<String> keys = new TreeSet<>();
        for (String key : requested == null ? List.<String>of() : requested) {
            if (key == null || !registry.knowsPermission(key.trim())) {
                throw new IllegalArgumentException("Unknown permission: " + key);
            }
            keys.add(key.trim());
        }
        if (keys.isEmpty()) {
            throw new IllegalArgumentException("permissions needs at least one permission");
        }
        return keys;
    }

    /**
     * The actor may put these permissions in a role: it must hold each one, except explicit-only ones, which an
     * administrator gives without holding them. Same rule as granting a role ({@link TeamRules#checkGrant}).
     */
    public static void checkAdded(Access actor, Collection<String> added, AccessRegistry registry) {
        for (String permission : added) {
            boolean explicitOnly = registry.permissions().stream()
                    .anyMatch(p -> p.key().equals(permission) && p.explicitOnly());
            if (!explicitOnly && !actor.can(permission)) {
                throw new SecurityException("You cannot give " + permission + ": you do not hold it");
            }
        }
    }
}
