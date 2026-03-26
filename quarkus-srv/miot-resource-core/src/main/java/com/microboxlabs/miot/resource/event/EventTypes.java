package com.microboxlabs.miot.resource.event;

public final class EventTypes {

    private EventTypes() {}

    public static final String ENTITY_CREATED = "ENTITY_CREATED";
    public static final String ENTITY_UPDATED = "ENTITY_UPDATED";
    public static final String STATUS_CHANGED = "STATUS_CHANGED";
    public static final String DEFERRED_FK = "DEFERRED_FK";
    public static final String FK_RESOLVED = "FK_RESOLVED";
    public static final String SCORE_COMPUTED = "SCORE_COMPUTED";
    public static final String SYMPTOM_ASSOCIATED = "SYMPTOM_ASSOCIATED";
    public static final String DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED";
    public static final String DOCUMENT_EXPIRED = "DOCUMENT_EXPIRED";
}
