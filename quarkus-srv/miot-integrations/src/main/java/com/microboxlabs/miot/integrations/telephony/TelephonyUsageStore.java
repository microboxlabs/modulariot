package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Subscription;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** The telephony ledger, the plan and the operators' SIP logins. */
public interface TelephonyUsageStore {

    /** Inserts the row; a row with the same channel and external id is left as it is. */
    void insert(UsageRow row);

    Optional<UsageRow> find(String id);

    Optional<UsageRow> findByExternal(String channel, String externalId);

    /** Replaces the row with this id. */
    void update(UsageRow row);

    /** STARTED or ENDED rows on the connection started after {@code since}: the calls holding a channel. */
    int busyChannels(String connectionId, Instant since);

    /** STARTED rows started before {@code before}: marked EXPIRED. Returns how many. */
    int expireStarted(Instant before);

    /** The tenant of the latest managed VOICE row to this number started after {@code since}. */
    Optional<String> latestCallerTenant(String calleeDigits, Instant since);

    /** Sum of billed minutes of the tenant's CONFIRMED managed VOICE rows in [from, to). */
    long billedMinutes(String tenantCode, Instant from, Instant to);

    /** The tenant's managed rows in [from, to), every status. */
    List<UsageRow> rows(String tenantCode, Instant from, Instant to);

    /** Tenants with managed rows in [from, to) or with a subscription. */
    List<String> tenants(Instant from, Instant to);

    void saveCredential(String sipUsername, String tenantCode, String credentialId, String connectionId);

    Optional<String> tenantOfSip(String sipUsername);

    Plan plan();

    Plan setPlan(Plan plan, String actor);

    Optional<Subscription> subscription(String tenantCode);

    void saveSubscription(String tenantCode, Integer monthlyMinutes, String actor);

    /** Cost of a billed minute or template for a destination type; zero when the plan has none. */
    default BigDecimal price(String destinationType) {
        return plan().price(destinationType);
    }
}
