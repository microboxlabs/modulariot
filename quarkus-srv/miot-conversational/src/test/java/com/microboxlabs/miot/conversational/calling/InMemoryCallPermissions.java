package com.microboxlabs.miot.conversational.calling;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** {@link CallPermissionStore} in memory, for tests. */
public class InMemoryCallPermissions implements CallPermissionStore {

    public record Request(String tenantCode, String number, String contact, String origin, String wamid,
            String requestedBy, Instant sentAt) {
    }

    private final Map<String, CallPermission> checkpoints = new LinkedHashMap<>();
    private final Map<String, PermissionEvent> events = new LinkedHashMap<>();

    @Override public synchronized <T> T locked(String number, String contact, java.util.function.Supplier<T> work) { return work.get(); }
    @Override public CallPermission checkpoint(String number, String contact) {
        return checkpoints.computeIfAbsent(number + "|" + contact, key -> find(number, contact).orElse(CallPermission.none(number, contact)));
    }
    @Override public void recordEvent(PermissionEvent event) { events.putIfAbsent(event.number() + "|" + event.contact() + "|" + event.id(), event); }
    @Override public List<PermissionEvent> events(String number, String contact) {
        return events.values().stream().filter(e -> e.number().equals(number) && e.contact().equals(contact)).toList();
    }

    public final Map<String, CallPermission> permissions = new LinkedHashMap<>();
    public final List<Request> requests = new ArrayList<>();

    @Override
    public Optional<CallPermission> find(String businessPhoneNumberId, String contactE164) {
        return Optional.ofNullable(permissions.get(businessPhoneNumberId + "|" + contactE164));
    }

    @Override
    public void save(CallPermission p) {
        permissions.put(p.businessPhoneNumberId() + "|" + p.contactE164(), p);
    }

    @Override
    public List<Instant> requestsSince(String businessPhoneNumberId, String contactE164, Instant since) {
        return requests.stream()
                .filter(r -> r.number().equals(businessPhoneNumberId) && r.contact().equals(contactE164))
                .map(Request::sentAt)
                .filter(t -> !t.isBefore(since))
                .sorted()
                .toList();
    }

    @Override
    public void recordRequest(String tenantCode, String businessPhoneNumberId, String contactE164, String origin,
            String wamid, String requestedBy, Instant sentAt) {
        if (wamid != null && requests.stream().anyMatch(r -> java.util.Objects.equals(r.wamid(), wamid) && r.number().equals(businessPhoneNumberId) && r.contact().equals(contactE164))) return;
        requests.add(new Request(tenantCode, businessPhoneNumberId, contactE164, origin, wamid, requestedBy,
                sentAt));
    }
}
