package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Subscription;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeSet;

/** Process-local {@link TelephonyUsageStore} for unit tests. Not a CDI bean. */
public class InMemoryTelephonyUsageStore implements TelephonyUsageStore {

    private final Map<String, UsageRow> rows = new LinkedHashMap<>();
    private final Map<String, String[]> credentials = new LinkedHashMap<>();
    private final Map<String, Subscription> subscriptions = new LinkedHashMap<>();
    private Plan plan = new Plan(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
            BigDecimal.ZERO, false, null, null);

    @Override
    public synchronized void insert(UsageRow row) {
        if (row.externalId() != null && findByExternal(row.channel(), row.externalId()).isPresent()) {
            return;
        }
        rows.putIfAbsent(row.id(), row);
    }

    @Override
    public synchronized Optional<UsageRow> find(String id) {
        return Optional.ofNullable(rows.get(id));
    }

    @Override
    public synchronized Optional<UsageRow> findByExternal(String channel, String externalId) {
        return rows.values().stream()
                .filter(r -> r.channel().equals(channel) && Objects.equals(r.externalId(), externalId)).findFirst();
    }

    @Override
    public synchronized void update(UsageRow row) {
        rows.put(row.id(), row);
    }

    @Override
    public synchronized int busyChannels(String connectionId, Instant since) {
        return (int) rows.values().stream()
                .filter(r -> Objects.equals(r.connectionId(), connectionId) && r.startedAt().isAfter(since)
                        && r.endedAt() == null
                        && (UsageRow.STARTED.equals(r.status()) || UsageRow.ENDED.equals(r.status())))
                .count();
    }

    @Override
    public synchronized int expireStarted(Instant before) {
        int n = 0;
        for (UsageRow r : List.copyOf(rows.values())) {
            if (UsageRow.STARTED.equals(r.status()) && r.startedAt().isBefore(before)) {
                rows.put(r.id(), new UsageRow(r.id(), r.tenantCode(), r.channel(), r.managed(), r.connectionId(),
                        r.externalId(), r.caseRef(), r.calleeNumber(), r.destinationType(), UsageRow.EXPIRED,
                        r.answeredAt(), r.seconds(), r.billedMinutes(), r.providerCost(), r.providerCurrency(),
                        r.source(), r.startedAt(), r.endedAt(), r.confirmedAt()));
                n++;
            }
        }
        return n;
    }

    @Override
    public synchronized Optional<String> latestCallerTenant(String calleeDigits, Instant since) {
        return rows.values().stream()
                .filter(r -> r.managed() && UsageRow.VOICE.equals(r.channel()) && r.calleeNumber() != null
                        && r.calleeNumber().replaceAll("\\D", "").equals(calleeDigits) && r.startedAt().isAfter(since))
                .max(Comparator.comparing(UsageRow::startedAt)).map(UsageRow::tenantCode);
    }

    @Override
    public synchronized long billedMinutes(String tenantCode, Instant from, Instant to) {
        return rows(tenantCode, from, to).stream()
                .filter(r -> UsageRow.VOICE.equals(r.channel()) && UsageRow.CONFIRMED.equals(r.status()))
                .mapToLong(r -> r.billedMinutes() == null ? 0 : r.billedMinutes()).sum();
    }

    @Override
    public synchronized List<UsageRow> rows(String tenantCode, Instant from, Instant to) {
        return rows.values().stream().filter(r -> r.managed() && r.tenantCode().equals(tenantCode)
                && !r.startedAt().isBefore(from) && r.startedAt().isBefore(to)).toList();
    }

    @Override
    public synchronized List<String> tenants(Instant from, Instant to) {
        TreeSet<String> out = new TreeSet<>(subscriptions.keySet());
        rows.values().stream().filter(r -> r.managed() && !r.startedAt().isBefore(from) && r.startedAt().isBefore(to))
                .forEach(r -> out.add(r.tenantCode()));
        return new ArrayList<>(out);
    }

    @Override
    public synchronized void saveCredential(String sipUsername, String tenantCode, String credentialId,
            String connectionId) {
        credentials.putIfAbsent(sipUsername, new String[] {tenantCode, credentialId, connectionId});
    }

    @Override
    public synchronized Optional<String> tenantOfSip(String sipUsername) {
        String[] c = credentials.get(sipUsername);
        return c == null ? Optional.empty() : Optional.of(c[0]);
    }

    @Override
    public synchronized Plan plan() {
        return plan;
    }

    @Override
    public synchronized Plan setPlan(Plan plan, String actor) {
        this.plan = new Plan(plan.minutesPerMonth(), plan.clMobileUsd(), plan.clLandlineUsd(), plan.otherUsd(),
                plan.whatsappCallUsd(), plan.whatsappTemplateUsd(), plan.enforced(), actor, Instant.now());
        return this.plan;
    }

    @Override
    public synchronized Optional<Subscription> subscription(String tenantCode) {
        return Optional.ofNullable(subscriptions.get(tenantCode));
    }

    @Override
    public synchronized void saveSubscription(String tenantCode, Integer monthlyMinutes, String actor) {
        subscriptions.put(tenantCode, new Subscription(monthlyMinutes, actor, Instant.now()));
    }
}
