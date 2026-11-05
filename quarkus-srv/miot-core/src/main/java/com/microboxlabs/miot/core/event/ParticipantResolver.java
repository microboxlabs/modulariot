package com.microboxlabs.miot.core.event;

import java.util.List;
import java.util.Map;

/**
 * Finds the people with a role in an event's context, such as the driver of a symptom case's trip. A producer
 * exposes one as a CDI bean for the context kinds it owns.
 */
public interface ParticipantResolver {

    boolean supports(String contextKind);

    /** The roles {@link #resolve} knows today in the tenant, for the rule editor's review. */
    List<String> roles(String tenantCode, String contextKind);

    /**
     * The participants with {@code role}; empty when nobody has it or the role is unknown.
     *
     * @param eventData the event's data as a map, which may already name the trip, asset or similar
     */
    List<Participant> resolve(String tenantCode, String contextKind, String contextKey, String role,
            Map<String, Object> eventData);
}
