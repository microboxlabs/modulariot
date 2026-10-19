package com.microboxlabs.miot.symptoms.catalog.store;

/** Another symptom of the organization already has this key. */
public class DuplicateSymptomKeyException extends IllegalStateException {

    public DuplicateSymptomKeyException(String key) {
        super("a symptom with key " + key + " already exists");
    }
}
