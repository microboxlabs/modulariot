package com.microboxlabs.miot.core.event;

import java.util.List;

/**
 * An organization's contact book, for rules that pick recipients by a condition on each contact. The module that
 * owns the book exposes one as a CDI bean.
 */
public interface ContactDirectory {

    /**
     * An active contact. Ids are normalised: {@code companyRut} without dots or dashes, upper case.
     *
     * @param member true when this contact is linked to an organization member
     * @param whatsapp their WhatsApp number in E.164, else their phone
     */
    record Entry(String id, String name, String role, List<String> tags, String company, String companyRut,
            String position, boolean member, String email, String whatsapp) {
    }

    /** The organization's active contacts. */
    List<Entry> active(String tenantCode);
}
