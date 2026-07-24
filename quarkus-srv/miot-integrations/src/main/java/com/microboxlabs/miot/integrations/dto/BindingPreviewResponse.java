package com.microboxlabs.miot.integrations.dto;

import java.util.List;
import java.util.Map;

/**
 * The server-side twin of the settings drawer's live preview: the exact body this mapping
 * would send, or the reasons it would not send one.
 *
 * <p>Having the server render it — rather than trusting the browser's own Handlebars — is
 * what lets an operator confirm that what they previewed is what will actually go out.
 */
public record BindingPreviewResponse(
        boolean valid,
        /** The rendered body when {@code valid} — an object, or an array for an array contract; empty otherwise. */
        Object payload,
        /** Every reason the mapping is not sendable; empty when {@code valid}. */
        List<String> problems) {

    public static BindingPreviewResponse ok(Object payload) {
        return new BindingPreviewResponse(true, payload, List.of());
    }

    public static BindingPreviewResponse invalid(List<String> problems) {
        return new BindingPreviewResponse(false, Map.of(), List.copyOf(problems));
    }
}
