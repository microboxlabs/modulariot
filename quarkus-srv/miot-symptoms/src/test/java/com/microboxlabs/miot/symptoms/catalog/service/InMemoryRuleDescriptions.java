package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.RuleDescription;
import com.microboxlabs.miot.symptoms.catalog.store.RuleDescriptionStore;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** In-memory {@link RuleDescriptionStore} for tests. */
public class InMemoryRuleDescriptions implements RuleDescriptionStore {

    private final Map<String, RuleDescription> rows = new HashMap<>();

    @Override
    public Optional<RuleDescription> find(String ruleHash, String locale, String audience) {
        return Optional.ofNullable(rows.get(key(ruleHash, locale, audience)));
    }

    @Override
    public void save(RuleDescription d) {
        rows.put(key(d.ruleHash(), d.locale(), d.audience()), d);
    }

    public int size() {
        return rows.size();
    }

    private static String key(String hash, String locale, String audience) {
        return hash + "|" + locale + "|" + audience;
    }
}
