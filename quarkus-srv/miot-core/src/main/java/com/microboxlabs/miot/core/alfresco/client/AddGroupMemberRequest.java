package com.microboxlabs.miot.core.alfresco.client;

/**
 * Request body for {@code POST /groups/{groupId}/members}.
 * {@code id} is the person authority id (Alfresco username / email),
 * {@code memberType} is always {@code "PERSON"} from this client —
 * we don't model nested groups.
 */
public record AddGroupMemberRequest(String id, String memberType) {

    public static AddGroupMemberRequest person(String personId) {
        return new AddGroupMemberRequest(personId, "PERSON");
    }
}
