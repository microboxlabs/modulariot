package com.microboxlabs.miot.core.event;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Conditions on one contact of the book: CEL over {@code contact} (an entry of {@link ContactDirectory}) and
 * {@code event}, the same language the communication rules use for a "contacts from the book" audience. The module
 * that evaluates them exposes one as a CDI bean.
 */
public interface ContactConditions {

    /** The condition's first compile problem, or empty when it is blank or gives yes or no. */
    Optional<String> problem(String condition);

    /**
     * For each condition, the ids of the organization's active contacts that meet it, in the book's order.
     * {@code data} is {@code event.data}. A blank or failing condition meets nobody.
     */
    List<List<String>> match(String tenantCode, List<String> conditions, Map<String, Object> data);
}
