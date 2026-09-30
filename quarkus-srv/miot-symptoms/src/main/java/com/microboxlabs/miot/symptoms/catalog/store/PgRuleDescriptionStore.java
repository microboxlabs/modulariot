package com.microboxlabs.miot.symptoms.catalog.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.microboxlabs.miot.symptoms.catalog.domain.RuleDescription;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link RuleDescriptionStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgRuleDescriptionStore implements RuleDescriptionStore {

    private static final String SELECT = """
            SELECT rule_hash, locale, audience, html FROM miot_symptoms.rule_description
            WHERE rule_hash = $1 AND locale = $2 AND audience = $3""";

    private static final String UPSERT = """
            INSERT INTO miot_symptoms.rule_description (rule_hash, locale, audience, html)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (rule_hash, locale, audience) DO UPDATE SET html = EXCLUDED.html""";

    private final Supplier<Pool> pool;

    @Inject
    PgRuleDescriptionStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgRuleDescriptionStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<RuleDescription> find(String ruleHash, String locale, String audience) {
        RowIterator<Row> rows = pool.get().preparedQuery(SELECT).execute(Tuple.of(ruleHash, locale, audience))
                .await().atMost(QUERY_TIMEOUT).iterator();
        if (!rows.hasNext()) {
            return Optional.empty();
        }
        Row r = rows.next();
        return Optional.of(new RuleDescription(r.getString("rule_hash"), r.getString("locale"),
                r.getString("audience"), r.getString("html")));
    }

    @Override
    public void save(RuleDescription d) {
        pool.get().preparedQuery(UPSERT).execute(Tuple.of(d.ruleHash(), d.locale(), d.audience(), d.html()))
                .await().atMost(QUERY_TIMEOUT);
    }
}
