package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.core.telephony.InboundCallers;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Finds a WhatsApp caller in the contact books (trip drivers are synced into them). The caller belongs to the one
 * organization with an active contact whose phone or WhatsApp number has the same digits; a Chilean number also
 * matches its national form. More than one organization: unknown. The case is the latest open treatment with a call
 * to that contact.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgInboundCallers implements InboundCallers {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String CHANNELS = "(CASE WHEN jsonb_typeof(channels) = 'string' "
            + "THEN (channels #>> '{}')::jsonb ELSE channels END)";
    private static final String DIGITS = "regexp_replace(coalesce(%s, ''), '\\D', '', 'g') = ANY($1)";
    static final String CONTACTS = "SELECT tenant_code, array_agg(id) AS ids, "
            + "(array_agg(name ORDER BY created_at, id))[1] AS name FROM miot_symptoms.contact WHERE active AND ("
            + DIGITS.formatted("phone") + " OR " + DIGITS.formatted(CHANNELS + " ->> 'whatsapp'") + " OR "
            + DIGITS.formatted(CHANNELS + " ->> 'phone'") + ") GROUP BY tenant_code ORDER BY tenant_code LIMIT 2";
    static final String OPEN_CASE = """
            SELECT t.symptom_id FROM miot_symptoms.treatment t
              JOIN miot_symptoms.treatment_action a ON a.treatment_id = t.id AND a.tenant_code = t.tenant_code
             WHERE t.tenant_code = $2 AND t.status = 'OPEN' AND a.kind = 'CALL'
               AND (a.contact_id = ANY($3) OR regexp_replace(coalesce(a.contact_phone, ''), '\\D', '', 'g') = ANY($1))
             ORDER BY a.performed_at DESC LIMIT 1""";

    private final Supplier<Pool> pool;

    @Inject
    PgInboundCallers(Instance<Pool> pool) {
        this(pool::get);
    }

    PgInboundCallers(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<Caller> find(String callerE164) {
        return lookup(callerE164).caller();
    }

    @Override
    public Lookup lookup(String callerE164) {
        String[] forms = forms(callerE164);
        if (forms.length == 0) return new Lookup(Optional.empty(), false);
        var matches = run(CONTACTS, Tuple.tuple().addArrayOfString(forms)).iterator();
        if (!matches.hasNext()) return new Lookup(Optional.empty(), false);
        Row contact = matches.next();
        if (matches.hasNext()) return new Lookup(Optional.empty(), true);
        String tenant = contact.getString("tenant_code");
        var cases = run(OPEN_CASE, Tuple.tuple().addArrayOfString(forms).addString(tenant)
                .addArrayOfUUID(contact.getArrayOfUUIDs("ids"))).iterator();
        String caseRef = cases.hasNext() ? String.valueOf(cases.next().getLong("symptom_id")) : null;
        return new Lookup(Optional.of(new Caller(tenant, contact.getString("name"), caseRef)), false);
    }

    /** The caller's digits, and for a Chilean number (56 and 9 digits) also the 9 national digits. */
    static String[] forms(String e164) {
        String digits = e164 == null ? "" : e164.replaceAll("\\D", "");
        if (digits.length() < 8) return new String[0];
        if (digits.startsWith("56") && digits.length() == 11) return new String[] {digits, digits.substring(2)};
        return new String[] {digits};
    }

    protected RowSet<Row> run(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(TIMEOUT);
    }
}
