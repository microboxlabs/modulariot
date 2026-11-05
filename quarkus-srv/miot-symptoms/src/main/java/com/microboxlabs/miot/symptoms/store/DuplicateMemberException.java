package com.microboxlabs.miot.symptoms.store;

/** Another contact of the tenant was already created from this organization member. */
public class DuplicateMemberException extends IllegalStateException {

    public DuplicateMemberException() {
        super("this member is already in the contact book");
    }
}
