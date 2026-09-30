package com.microboxlabs.miot.symptoms.catalog.store;

import com.microboxlabs.miot.symptoms.catalog.domain.RuleDescription;
import java.util.Optional;

/** Descriptions already written for a rule text, so each is written once. */
public interface RuleDescriptionStore {

    Optional<RuleDescription> find(String ruleHash, String locale, String audience);

    void save(RuleDescription description);
}
