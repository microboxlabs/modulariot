package com.microboxlabs.miot.conversational.calling;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Call permissions by business number and contact, and the permission requests sent. */
public interface CallPermissionStore {

    <T> T locked(String number, String contact, java.util.function.Supplier<T> work);

    /** Captures the pre-journal permission exactly once. Must be called inside the contact lock. */
    CallPermission checkpoint(String number, String contact);

    void recordEvent(PermissionEvent event);

    List<PermissionEvent> events(String number, String contact);


    Optional<CallPermission> find(String businessPhoneNumberId, String contactE164);

    void save(CallPermission permission);

    /** When each request to the contact from the number was sent, at or after {@code since}, oldest first. */
    List<Instant> requestsSince(String businessPhoneNumberId, String contactE164, Instant since);

    void recordRequest(String tenantCode, String businessPhoneNumberId, String contactE164, String origin,
            String wamid, String requestedBy, Instant sentAt);
}
