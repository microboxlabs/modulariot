package com.microboxlabs.miot.core.telephony;

import java.util.Optional;

/**
 * Who is calling the tower: the organization whose contact book (or trip driver) has the number. Implemented by
 * the symptoms module. Empty when no organization, or more than one, has the number.
 */
public interface InboundCallers {

    /** {@code caseRef} is an open case of the caller, or null. */
    record Caller(String tenantCode, String name, String caseRef) {
    }

    Optional<Caller> find(String callerE164);
}
