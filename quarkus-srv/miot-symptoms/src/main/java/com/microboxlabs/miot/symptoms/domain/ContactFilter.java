package com.microboxlabs.miot.symptoms.domain;

/**
 * Which contacts of the book a page holds. A null field does not filter. {@code text} matches the name, role,
 * company, email or document; {@code role}, {@code company} and {@code tag} match whole values, ignoring case.
 * {@code member} true keeps the contacts created from an organization member, false the others.
 */
public record ContactFilter(String text, Boolean member, String role, String company, String tag, Boolean active) {

    public static final ContactFilter ALL = new ContactFilter(null, null, null, null, null, null);
}
