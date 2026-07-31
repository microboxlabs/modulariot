package com.microboxlabs.miot.integrations.dto;

/**
 * One selectable Auth0 machine-to-machine application.
 *
 * <p>Carries identifiers and labels only — never a secret, and nothing that
 * would let a caller act as the client. That is deliberate: this DTO crosses
 * into the browser to populate a picker, so the safe shape is the whole
 * contract rather than a convention callers have to remember.
 *
 * @param clientId    the Auth0 client id, which is also a tenant's {@code
 *                    Tenant.code} when the client backs an organization
 * @param name        human label for the picker
 * @param description optional secondary line; null when there is nothing useful to add
 * @param active      false for clients kept for audit but not to be configured against
 * @param source      where the row came from — see {@link Source}
 */
public record Auth0ClientSummary(
        String clientId,
        String name,
        String description,
        boolean active,
        Source source) {

    /**
     * Provenance of a row, surfaced so the UI can group and so an operator can
     * tell "this is definitely yours" from "this exists in the directory".
     */
    public enum Source {
        /**
         * Derived from the organization tree: the caller's own
         * {@code tenant_client_id} or one of its children's. Authoritative —
         * the org record is what grants the entitlement in the first place.
         */
        ORGANIZATION,
        /**
         * Published by the external applications service. Advisory: the service
         * knows about applications no organization is bound to yet.
         */
        DIRECTORY
    }
}
