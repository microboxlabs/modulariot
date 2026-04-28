package com.microboxlabs.miot.core.alfresco;

/**
 * Minimal projection of an Alfresco person record used by the admin UI
 * (member lists, user search). The {@code id} is the Alfresco personId,
 * which in this deployment is the user's email.
 */
public record AlfrescoPerson(
        String id,
        String email,
        String firstName,
        String lastName,
        String displayName) {
}
