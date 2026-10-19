package com.microboxlabs.miot.symptoms.store;

/** Another contact of the tenant already has this national id. */
public class DuplicateNationalIdException extends IllegalStateException {

    public DuplicateNationalIdException(String nationalId) {
        super("a contact with national id " + nationalId + " already exists");
    }
}
