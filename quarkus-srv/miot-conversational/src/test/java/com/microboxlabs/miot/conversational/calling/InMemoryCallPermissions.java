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

    private final Map<java.util.UUID, Request> reservations = new LinkedHashMap<>();

    @Override
    public void reserveRequest(java.util.UUID id, String tenant, String number, String contact, String actor, Instant at) {
        Request request = new Request(tenant, number, contact, CallPermissionService.ORIGIN_MANUAL, null, actor, at);
        reservations.put(id, request);
        requests.add(request);
    }

    @Override
    public void completeRequest(java.util.UUID id, String wamid, Instant at) {
        Request before = reservations.get(id);
        requests.remove(before);
        Request after = new Request(before.tenantCode(), before.number(), before.contact(), before.origin(), wamid,
                before.requestedBy(), at);
        requests.add(after);
        reservations.put(id, after);
    }

    @Override
    public void cancelRequest(java.util.UUID id) {
        Request request = reservations.get(id);
        if (request != null && request.wamid() == null) {
            requests.remove(request);
            reservations.remove(id);
        }
    }

    @Override
    public void recordRequest(String tenantCode, String businessPhoneNumberId, String contactE164, String origin,
            String wamid, String requestedBy, Instant sentAt) {
        if (wamid != null && requests.stream().anyMatch(r -> java.util.Objects.equals(r.wamid(), wamid) && r.number().equals(businessPhoneNumberId) && r.contact().equals(contactE164))) return;
        requests.add(new Request(tenantCode, businessPhoneNumberId, contactE164, origin, wamid, requestedBy,
                sentAt));
    }
}
