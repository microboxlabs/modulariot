package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.RuleDescription;
import com.microboxlabs.miot.symptoms.catalog.store.RuleDescriptionStore;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** In-memory {@link RuleDescriptionStore} for tests. */
public class InMemoryRuleDescriptions implements RuleDescriptionStore {

    private final Map<String, RuleDescription> rows = new HashMap<>();
    /** Calls to {@link #findAll}, so a test can check the list reads the cache once. */
    int lookups;

    @Override
    public Optional<RuleDescription> find(String ruleHash, String locale, String audience) {
        return Optional.ofNullable(rows.get(key(ruleHash, locale, audience)));
    }

    @Override
    public Map<String, RuleDescription> findAll(Collection<String> ruleHashes, String locale, String audience) {
        lookups++;
        Map<String, RuleDescription> out = new HashMap<>();
        for (String hash : ruleHashes) {
            find(hash, locale, audience).ifPresent(d -> out.put(hash, d));
        }
        return out;
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
