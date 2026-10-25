package com.microboxlabs.miot.symptoms.domain;

import java.util.List;

/** What the whole book holds, for the filters and pickers of a paged list. Each value once, ignoring case. */
public record ContactFacets(
        long total,
        List<String> roles,
        List<Company> companies,
        List<String> tags,
        List<Member> members) {

    /** A company used in the book, with the first tax id given for it. */
    public record Company(String name, String rut, String taxIdType) {
    }

    /** An organization member already in the book, and the contact made from it. */
    public record Member(String memberUserId, String contactId) {
    }
}
