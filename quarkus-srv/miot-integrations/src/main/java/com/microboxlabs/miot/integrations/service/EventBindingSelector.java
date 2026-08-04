package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;

/**
 * Picks the one binding that answers an event in a scope. Shared by the fetch path and
 * event-addressed dispatch, so "which binding wins" cannot drift between them.
 *
 * <p>Rules: armed bindings for the event, narrowed to scope and match condition; a binding
 * scoped to this exact scope beats an every-scope one; two candidates at the same
 * specificity is operator ambiguity and parks — guessing would silently pick one
 * tenant-visible behaviour over another.
 */
@ApplicationScoped
public class EventBindingSelector {

    private final IntegrationEventBindingRepository bindingRepository;

    @Inject
    public EventBindingSelector(IntegrationEventBindingRepository bindingRepository) {
        this.bindingRepository = bindingRepository;
    }

    /** @return the winning binding, or null when nothing is configured to answer */
    public IntegrationEventBinding select(String tenantClientId, String eventType,
            String scopeKind, String scopeKey, Map<String, Object> context) {
        List<IntegrationEventBinding> matching =
                bindingRepository.listArmed(tenantClientId, eventType).stream()
                        .filter(binding -> binding.matchesScope(scopeKind, scopeKey))
                        .filter(binding -> EventConditionMatcher.matches(binding.matchCondition(), context))
                        .toList();
        if (matching.isEmpty()) {
            return null;
        }
        List<IntegrationEventBinding> scoped =
                matching.stream().filter(binding -> !binding.appliesToEveryScope()).toList();
        List<IntegrationEventBinding> candidates = scoped.isEmpty() ? matching : scoped;
        if (candidates.size() > 1) {
            throw new NonRetryableJobException("Event " + eventType + " has " + candidates.size()
                    + " bindings at the same specificity for scope " + scopeKind + "/" + scopeKey
                    + " — exactly one must answer; disable the extras");
        }
        return candidates.get(0);
    }
}
