package com.microboxlabs.miot.integrations.jobs;

import java.util.Set;

/** Job types that only trusted in-process producers may enqueue, even when their handlers are not loaded here. */
public final class InternalJobTypes {

    public static final String WHATSAPP_INBOUND_MESSAGE = "whatsapp.inbound.message";
    public static final String WHATSAPP_INBOUND_STATUS = "whatsapp.inbound.status";

    private static final Set<String> RESERVED = Set.of(WHATSAPP_INBOUND_MESSAGE, WHATSAPP_INBOUND_STATUS);

    private InternalJobTypes() {
    }

    public static boolean contains(String jobType) {
        return jobType != null && RESERVED.contains(jobType);
    }
}
