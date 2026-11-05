package com.microboxlabs.miot.integrations.jobs;

import java.util.Set;

/** Job types that only trusted in-process producers may enqueue, even when their handlers are not loaded here. */
public final class InternalJobTypes {

    public static final String WHATSAPP_INBOUND_MESSAGE = "whatsapp.inbound.message";
    public static final String WHATSAPP_INBOUND_STATUS = "whatsapp.inbound.status";
    /** A contact's answer to a WhatsApp call permission request. */
    public static final String WHATSAPP_INBOUND_CALL_PERMISSION = "whatsapp.inbound.call_permission";
    /** A WhatsApp call's connect or terminate event. */
    public static final String WHATSAPP_INBOUND_CALL = "whatsapp.inbound.call";
    /** A conversation rule's WhatsApp message to one recipient. */
    public static final String WHATSAPP_SEND = "whatsapp.send";
    /** A conversation rule's email to one recipient. */
    public static final String EMAIL_SEND = "email.send";

    private static final Set<String> RESERVED = Set.of(WHATSAPP_INBOUND_MESSAGE, WHATSAPP_INBOUND_STATUS,
            WHATSAPP_INBOUND_CALL_PERMISSION, WHATSAPP_INBOUND_CALL, WHATSAPP_SEND, EMAIL_SEND);

    private InternalJobTypes() {
    }

    public static boolean contains(String jobType) {
        return jobType != null && RESERVED.contains(jobType);
    }
}
